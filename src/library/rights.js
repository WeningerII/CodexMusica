// ─── Library chunk: rights ─────────────────────────────────────────────────
// Wrapped by the build as CMLibraryDefine('rights', function () { … }).
// Sources & rights (#library/rights): catalog census, the sources table
// (collections.json, one row per source file) with a detail panel that
// rebuilds a reading's exact rights object from the static rights/, notices/
// and meta/ shards (scripts/build_library_data.py), artwork credits, and the
// export panel. exportPanel(container, lib) is reused by other views.
//
// Downloads (docs/library-native-design.md, "Exports and downloads"):
//   selection: POST lib.api/exports/plan {reading_unit_ids, format}, an
//     uncredentialed CORS HEAD of the plan's URL, then a navigation to it;
//     409 PLAN_STALE / PLAN_EXPIRED on the HEAD re-plans once from the stored
//     {format, ids}; 409 USE_CORPUS_PACKAGE switches to the corpus package;
//   corpus: GET lib.api/health names /corpus/<sha16>/<format>.zip; a 404 HEAD
//     (an old package) re-reads health once.
// Every download-path error is an attachment server side, so a navigation
// never replaces the page; the HEAD keeps errors in the page as toasts.
/* global esc, icon, uiButton, uiEmptyState, showToast, uiDownload, libraryChunk */
'use strict';

const FORMATS = [
  ['text', 'Text'],
  ['json', 'JSON with coordinates'],
  ['csv', 'CSV physical / analysis rows'],
];
const CENSUS = [
  'source_files',
  'collections',
  'works',
  'editions',
  'reading_units',
  'readable_collections',
  'readable_works',
  'readable_editions',
  'readable_reading_units',
];
const PAGE = 50;
const PENDING = 'pending-export';
const FORMAT_KEY = 'export-format';

if (!document.querySelector('style[data-lib="rights"]'))
  document.head.insertAdjacentHTML(
    'beforeend',
    `<style data-lib="rights">
#surface-library .lr-view{display:grid;gap:16px;padding:4px 0 24px}
#surface-library .lr-head h2{margin:0;font-size:22px;color:var(--cm-text)}
#surface-library .lr-head p,#surface-library .lr-note{margin:4px 0 0;color:var(--cm-text-muted);font-size:13px;line-height:1.5}
#surface-library .lr-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
@media (max-width:899px){#surface-library .lr-layout{grid-template-columns:minmax(0,1fr)}}
#surface-library .lr-card{background:var(--cm-surface);border:1px solid var(--cm-border);border-radius:12px;padding:16px;display:grid;gap:10px;min-width:0}
#surface-library .lr-card h3{margin:0;font-size:16px;color:var(--cm-text);display:flex;gap:8px;align-items:center}
#surface-library .lr-card h4{margin:6px 0 0;font-size:13px;color:var(--cm-text-secondary);text-transform:uppercase;letter-spacing:.04em}
#surface-library .lr-census{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:0}
#surface-library .lr-census div{background:var(--cm-surface-subtle);border-radius:8px;padding:8px 10px}
#surface-library .lr-census dt{font-size:12px;color:var(--cm-text-muted)}
#surface-library .lr-census dd{margin:2px 0 0;font-size:16px;font-variant-numeric:tabular-nums;color:var(--cm-text)}
#surface-library .lr-table{width:100%;border-collapse:collapse;font-size:14px}
#surface-library .lr-table th{text-align:left;font-weight:500;color:var(--cm-text-muted);font-size:12px;padding:6px 8px;border-bottom:1px solid var(--cm-border)}
#surface-library .lr-table td{padding:6px 8px;border-bottom:1px solid var(--cm-border-subtle);color:var(--cm-text);vertical-align:middle}
#surface-library .lr-table tr[data-lr]{cursor:pointer}
#surface-library .lr-table tr[data-lr]:hover{background:var(--cm-hover)}
#surface-library .lr-table tr[aria-selected="true"]{background:var(--cm-accent-soft)}
#surface-library .lr-table td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
#surface-library .lr-thumb{width:36px;height:36px;border-radius:6px;object-fit:cover;display:block;background:var(--cm-surface-sunken)}
#surface-library .lr-thumb.cover{border-top:3px solid var(--cm-blue)}
#surface-library .lr-detail{border-left:3px solid var(--cm-accent)}
#surface-library .lr-detail dl{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 12px;margin:0;font-size:13px}
#surface-library .lr-detail dt{color:var(--cm-text-muted)}
#surface-library .lr-detail dd{margin:0;color:var(--cm-text);overflow-wrap:anywhere}
#surface-library .lr-detail ul{margin:0;padding-left:18px;font-size:13px;color:var(--cm-text);overflow-wrap:anywhere}
#surface-library .lr-notice pre{white-space:pre-wrap;max-height:320px;overflow:auto;font-size:12px;background:var(--cm-surface-subtle);border-radius:8px;padding:8px;color:var(--cm-text-secondary)}
#surface-library .lr-art{display:grid;grid-template-columns:72px minmax(0,1fr);gap:12px;align-items:start;font-size:13px;color:var(--cm-text)}
#surface-library .lr-art img{width:72px;height:72px;object-fit:cover;border-radius:8px;background:var(--cm-surface-sunken)}
#surface-library .lr-art small{display:block;color:var(--cm-text-muted);margin-top:2px}
#surface-library .lr-art a,#surface-library .lr-detail a{color:var(--cm-link)}
#surface-library .lr-export{position:sticky;top:8px}
#surface-library .lr-export .cm-btn{width:100%;justify-content:center}
#surface-library .lr-link{background:none;border:0;padding:4px 0;color:var(--cm-link);cursor:pointer;font:inherit;font-size:13px;text-align:left}
#surface-library .lr-link:disabled{color:var(--cm-text-disabled);cursor:default}
#surface-library .lr-credit{display:flex;gap:8px;font-size:13px;color:var(--cm-text-secondary);background:var(--cm-surface-subtle);border-radius:8px;padding:8px}
#surface-library .lr-sel{list-style:none;margin:0;padding:0;max-height:240px;overflow:auto;font-size:12px}
#surface-library .lr-sel li{display:flex;gap:6px;align-items:center;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--cm-border-subtle);color:var(--cm-text-secondary)}
#surface-library .lr-sel code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#surface-library .lr-sel li>span{display:flex;gap:2px;flex:none}
#surface-library [data-lr-status]:empty{display:none}
#surface-library .lr-sel button{background:none;border:0;color:var(--cm-text-muted);cursor:pointer;padding:2px}
#surface-library .lr-filter{display:flex;gap:8px;flex-wrap:wrap}
#surface-library .lr-filter .cm-input{flex:1 1 200px}
#surface-library .lr-err{color:var(--cm-danger-text);font-size:13px}
</style>`
  );

// ── device state: lib.device if core offers one, else localStorage ─────────
function device(lib) {
  if (lib.device && typeof lib.device.get === 'function') return lib.device;
  return {
    async get(key, fallback) {
      try {
        const raw = localStorage.getItem('cm-library:' + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    async set(key, value) {
      try {
        if (value == null) localStorage.removeItem('cm-library:' + key);
        else localStorage.setItem('cm-library:' + key, JSON.stringify(value));
      } catch {
        /* storage blocked: the export still runs; only Resume is lost */
      }
    },
  };
}

// ── static rights data ────────────────────────────────────────────────────
const rowsShard = (digest) => (parseInt(digest.slice(0, 2), 16) >> 2).toString(16).padStart(2, '0');

// The exact canonical rights object of one reading (rebuild_rights in
// lyric-harness/library/catalog_static_export.py): interned object, its
// sources.tsv rows, and notice texts by sha256.
async function rightsObject(lib, ref) {
  const shard = await lib.json(`rights/r-${ref.slice(0, 2)}.json.gz`);
  const interned = shard.rights?.[ref];
  if (!interned) throw Error('Rights record not found: ' + ref.slice(0, 12));
  const rights = { ...interned };
  for (const key of ['sources', 'file_sources']) {
    rights[key] = await Promise.all(
      (interned[key] || []).map(async (digest) => {
        const rows = await lib.json(`rights/rows-${rowsShard(digest)}.json.gz`);
        return rows.rows?.[digest] || { missing: digest };
      })
    );
  }
  rights.notices = await Promise.all(
    (interned.notices || []).map(async (n) => {
      const file = await lib.json(`notices/${n.sha256}.json`);
      return { ...n, text: file.text };
    })
  );
  return rights;
}
async function metadataObject(lib, ref) {
  if (!ref) return null;
  const shard = await lib.json(`meta/${rowsShard(ref)}.json.gz`);
  return shard.metadata?.[ref] || null;
}

const artSrc = (id, size = 240) => `assets/library/art/${id}-${size}.webp`;
const fmtBytes = (n) =>
  !Number.isFinite(n)
    ? ''
    : n >= 1e9
      ? (n / 1e9).toFixed(2) + ' GB'
      : n >= 1e6
        ? (n / 1e6).toFixed(1) + ' MB'
        : n >= 1e3
          ? Math.round(n / 1e3) + ' KB'
          : n + ' B';
const humanKey = (k) => k.replace(/_/g, ' ');
const list = (items) =>
  items?.length
    ? `<ul>${items.map((x) => `<li>${esc(typeof x === 'string' ? x : JSON.stringify(x))}</li>`).join('')}</ul>`
    : '<p class="lr-note">None recorded.</p>';
const linkify = (s) =>
  esc(s).replace(
    /https?:\/\/[^\s<>"']+/g,
    (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`
  );

// ── export: requests ──────────────────────────────────────────────────────
// fetch(), never lib.get: the export path must read error bodies and statuses.
async function call(url, opts = {}) {
  const res = await fetch(url, { credentials: 'omit', mode: 'cors', cache: 'no-store', ...opts });
  let body = null;
  if (opts.method !== 'HEAD') {
    try {
      body = await res.json();
    } catch {
      body = null;
    }
  }
  return { res, body };
}
class ExportFailure extends Error {
  constructor(status, body, res) {
    const e = body?.error || {};
    super(e.message || `The export service answered ${status}.`);
    this.status = status;
    this.code = e.code || (status === 429 ? 'RATE_LIMITED' : status ? 'HTTP_' + status : 'NETWORK');
    this.remedy = e.remedy || '';
    this.detail = e;
    this.retryAfter = Number(res?.headers?.get?.('Retry-After')) || 0;
  }
}
async function plan(lib, ids, format) {
  let r;
  try {
    r = await call(lib.api + '/exports/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reading_unit_ids: ids, format }),
    });
  } catch {
    throw new ExportFailure(0, { error: { message: 'The export service could not be reached.' } });
  }
  if (!r.res.ok) throw new ExportFailure(r.res.status, r.body, r.res);
  return r.body;
}
async function head(url) {
  try {
    const { res } = await call(url, { method: 'HEAD' });
    return res;
  } catch {
    return { ok: false, status: 0, headers: new Headers() };
  }
}
function navigate(url) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
}
const absolute = (lib, url) => new URL(url, lib.api.replace(/\/library\/v1\/?$/, '/')).href;

let health = null;
async function corpusInfo(lib, fresh = false) {
  if (!health || fresh)
    health = fetch(lib.api + '/health', {
      credentials: 'omit',
      cache: fresh ? 'no-store' : 'default',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(Error('health ' + r.status))))
      .catch((e) => {
        health = null;
        throw e;
      });
  return (await health).corpus || {};
}

// ── export: the panel ─────────────────────────────────────────────────────
function exportPanel(container, lib) {
  const store = device(lib);
  const state = {
    format: 'text',
    busy: false,
    pending: null,
    error: '',
    unsaved: false,
    corpus: null,
    showAll: false,
  };
  const sel = lib.selection;
  container.classList.add('lr-card', 'lr-export');

  const draw = () => {
    if (!container.isConnected && state.drawn) return;
    state.drawn = true;
    const ids = [...sel.ids];
    const n = ids.length;
    const shown = state.showAll ? ids : ids.slice(0, 20);
    const corpus = state.corpus?.[state.format];
    container.innerHTML = `<h3>${icon('download', 20)}Export selection</h3>
<p class="lr-note" data-lr-count>${n.toLocaleString()} pinned reading unit${n === 1 ? '' : 's'} · On this device${state.unsaved ? ' · unsaved' : ''}</p>
<label class="lr-note" for="lr-format">Format</label>
<select id="lr-format" class="cm-select" data-lr-format>${FORMATS.map(([v, l]) => `<option value="${v}"${v === state.format ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
<p class="lr-credit">${icon('info', 16)}<span>Every ZIP includes PROVENANCE.json, ATTRIBUTION.txt and applicable notices. Credits are required and must accompany reuse.</span></p>
<p class="lr-note">Source artwork and device speech are excluded: artwork is credited on Sources &amp; rights and is in no package. Snapshot updates do not add items to this selection.</p>
${uiButton('lr-export', state.busy === 'selection' ? 'Preparing package…' : 'Export selected readings', 'download', `class="cm-btn cm-btn-primary"${!n || state.busy ? ' disabled' : ''}`)}
${uiButton('lr-corpus', state.busy === 'corpus' ? 'Starting download…' : 'Export readable corpus' + (corpus?.bytes ? ` (${fmtBytes(corpus.bytes)})` : ''), 'download', `class="cm-btn cm-btn-outline"${state.busy ? ' disabled' : ''}`)}
${state.pending ? uiButton('lr-resume', 'Resume prepared export', 'refresh-cw', `class="cm-btn cm-btn-tonal"${state.busy ? ' disabled' : ''}`) : ''}
${state.pending ? `<button type="button" class="lr-link" data-lr-act="forget">Forget export reference (${state.pending.ids.length.toLocaleString()} · ${esc(state.pending.format)})</button>` : ''}
${state.error ? `<p class="lr-err" role="alert">${state.error}</p>` : ''}
<div class="cm-status" aria-live="polite" data-lr-status></div>
${
  n
    ? `<h4>Selected</h4><ul class="lr-sel">${shown
        .map(
          (id) =>
            `<li><code title="${esc(id)}">${esc(id.replace(/^reading_/, ''))}</code><span><button type="button" data-lr-act="open" data-id="${esc(id)}" aria-label="Open ${esc(id)}" title="Open">${icon('book-open', 14)}</button><button type="button" data-lr-act="remove" data-id="${esc(id)}" aria-label="Remove ${esc(id)} from export selection" title="Remove">${icon('x', 14)}</button></span></li>`
        )
        .join(
          ''
        )}</ul>${n > shown.length ? `<button type="button" class="lr-link" data-lr-act="all">Show all ${n.toLocaleString()}</button>` : ''}
<button type="button" class="lr-link" data-lr-act="clear">Clear selection</button>`
    : `<p class="lr-note">Nothing selected yet. Add readings from Works, a collection, or the reader.</p>`
}
<button type="button" class="lr-link" data-lr-act="save"${n ? '' : ' disabled'}>${state.unsaved ? 'Download unsaved selection' : 'Download selection list'} (library-selection.json)</button>`;
  };
  const status = (text) => {
    const el = container.querySelector('[data-lr-status]');
    if (el) el.textContent = text;
  };
  const fail = (e) => {
    const extra =
      e.code === 'SELECTION_UNAVAILABLE' && e.detail?.reading_unit_ids?.length
        ? `<br>Unavailable: ${e.detail.reading_unit_ids.map((x) => `<code>${esc(x)}</code>`).join(', ')}${e.detail.unavailable_count > e.detail.reading_unit_ids.length ? ` and ${e.detail.unavailable_count - e.detail.reading_unit_ids.length} more` : ''}. <button type="button" class="lr-link" data-lr-act="drop">Remove unavailable items</button>`
        : '';
    const wait = e.retryAfter ? ` Retry in ${e.retryAfter} s.` : '';
    state.error = esc(e.message + (e.remedy ? ' ' + e.remedy : '') + wait) + extra;
    state.lastFailure = e;
    showToast(e.message + wait, 'error');
  };

  // HEAD, then navigate. Returns the HEAD status.
  async function start(url) {
    const res = await head(url);
    if (res.ok) {
      navigate(url);
      return 200;
    }
    return res.status;
  }
  async function runCorpus(format) {
    state.busy = 'corpus';
    state.error = '';
    draw();
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const info = (await corpusInfo(lib, attempt > 0))[format];
        if (!info?.url)
          throw new ExportFailure(503, {
            error: {
              message: 'The readable corpus package is unavailable.',
              remedy: 'Retry later.',
            },
          });
        const st = await start(absolute(lib, info.url));
        if (st === 200) {
          showToast(
            `Downloading the readable corpus (${fmtBytes(info.bytes)}), including source credits.`,
            'success'
          );
          return;
        }
        if (st === 404) continue; // an old package URL: health names the current one
        throw new ExportFailure(st, null, null);
      }
      throw new ExportFailure(404, {
        error: {
          message: 'The corpus package moved and the current one could not be found.',
          remedy: 'Retry later.',
        },
      });
    } catch (e) {
      fail(
        e instanceof ExportFailure
          ? e
          : new ExportFailure(0, { error: { message: 'The export service could not be reached.' } })
      );
    } finally {
      state.busy = false;
      draw();
    }
  }
  async function runSelection(ids, format) {
    state.busy = 'selection';
    state.error = '';
    draw();
    const pending = { format, ids: [...ids].sort() };
    state.pending = pending;
    await store.set(PENDING, pending);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        status(attempt ? 'Re-planning the export…' : 'Planning the export…');
        let p;
        try {
          p = await plan(lib, pending.ids, format);
        } catch (e) {
          if (e.code === 'USE_CORPUS_PACKAGE') {
            state.pending = null;
            await store.set(PENDING, null);
            state.busy = false;
            showToast(
              'Your selection is the whole readable corpus; downloading the prebuilt package.'
            );
            return runCorpus(format);
          }
          throw e;
        }
        status(
          `Starting download · ${p.entries?.toLocaleString?.() ?? '?'} files · ${fmtBytes(p.bytes)}`
        );
        const st = await start(absolute(lib, p.url));
        if (st === 200) {
          state.pending = null;
          await store.set(PENDING, null);
          showToast('Export started, including source credits.', 'success');
          return;
        }
        if (st === 409 || st === 404) continue; // PLAN_STALE / PLAN_EXPIRED: re-plan once
        throw new ExportFailure(
          st,
          st === 429
            ? {
                error: {
                  code: 'RATE_LIMITED',
                  message: 'Too many downloads are running; retry shortly.',
                },
              }
            : null,
          null
        );
      }
      throw new ExportFailure(409, {
        error: { message: 'The export plan kept changing.', remedy: 'Retry the export.' },
      });
    } catch (e) {
      fail(
        e instanceof ExportFailure
          ? e
          : new ExportFailure(0, { error: { message: String(e?.message || e) } })
      );
    } finally {
      state.busy = false;
      draw();
    }
  }

  container.addEventListener('change', (e) => {
    if (e.target.matches('[data-lr-format]')) {
      state.format = e.target.value;
      store.set(FORMAT_KEY, state.format);
      draw();
    }
  });
  container.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ui],[data-lr-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.ui || b.dataset.lrAct;
    if (b.dataset.ui) e.stopPropagation();
    if (act === 'lr-export') runSelection([...sel.ids], state.format);
    else if (act === 'lr-corpus') runCorpus(state.format);
    else if (act === 'lr-resume' && state.pending)
      runSelection(state.pending.ids, state.pending.format);
    else if (act === 'forget') {
      state.pending = null;
      await store.set(PENDING, null);
      draw();
    } else if (act === 'clear') {
      sel.clear();
    } else if (act === 'remove') sel.remove(b.dataset.id);
    else if (act === 'open') lib.go('/read/' + b.dataset.id);
    else if (act === 'all') {
      state.showAll = true;
      draw();
    } else if (act === 'drop') {
      for (const id of state.lastFailure?.detail?.reading_unit_ids || []) sel.remove(id);
      state.error = '';
      draw();
      if (
        (state.lastFailure?.detail?.unavailable_count || 0) >
        (state.lastFailure?.detail?.reading_unit_ids?.length || 0)
      )
        showToast('More unavailable items remain; export again to find them.');
    } else if (act === 'save')
      uiDownload(
        'library-selection.json',
        JSON.stringify({ format: 1, reading_unit_ids: [...sel.ids].sort() }, null, 2) + '\n',
        'application/json'
      );
  });
  const off = sel.onChange?.((info) => {
    if (info && typeof info === 'object' && 'unsaved' in info) state.unsaved = !!info.unsaved;
    if (sel.unsaved !== undefined) state.unsaved = !!sel.unsaved;
    if (container.isConnected) draw();
  });
  if (sel.unsaved !== undefined) state.unsaved = !!sel.unsaved;
  draw();
  Promise.all([store.get(PENDING, null), store.get(FORMAT_KEY, 'text')]).then(([p, f]) => {
    if (p && Array.isArray(p.ids) && p.ids.length) state.pending = p;
    if (FORMATS.some(([v]) => v === f)) state.format = f;
    draw();
  });
  corpusInfo(lib)
    .then((c) => {
      state.corpus = c;
      draw();
    })
    .catch(() => {});
  return {
    redraw: draw,
    destroy: () => typeof off === 'function' && off(),
    exportSelection: () => runSelection([...sel.ids], state.format),
    exportCorpus: () => runCorpus(state.format),
  };
}

// ── the view ──────────────────────────────────────────────────────────────
const view = { filter: '', limit: PAGE, current: null, unit: null };

async function show(main, sub, lib) {
  main.dataset.libraryChunk = 'rights';
  const params = new URLSearchParams(sub.split('?')[1] || '');
  if (params.get('source')) view.current = params.get('source');
  main.innerHTML = `<div class="lr-view">
<div class="lr-head"><h2>Sources &amp; rights</h2><p>Text, editions, transcriptions and artwork retain their own records.</p></div>
<div class="lr-layout"><div class="lr-col" style="display:grid;gap:16px;min-width:0">
<section class="lr-card" data-lr-census>${uiEmptyState({ title: 'Loading the catalog census' })}</section>
<section class="lr-card lr-detail" data-lr-detail hidden></section>
<section class="lr-card" data-lr-sources>${uiEmptyState({ title: 'Loading sources' })}</section>
<section class="lr-card" data-lr-art>${uiEmptyState({ title: 'Loading artwork credits' })}</section>
<section class="lr-card" data-lr-methods></section>
</div><aside data-lr-export></aside></div></div>`;
  const $ = (s) => main.querySelector(s);
  exportPanel($('[data-lr-export]'), lib);

  const retry = (el, title, fn) => {
    el.innerHTML = uiEmptyState({
      title,
      text: 'Check your connection, then retry.',
      tone: 'danger',
      actions: uiButton('lr-retry', 'Retry', 'refresh-cw', 'class="cm-btn cm-btn-outline"'),
    });
    el.querySelector('[data-ui="lr-retry"]').addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
    });
  };

  const census = async () => {
    const el = $('[data-lr-census]');
    try {
      const cat = await lib.catalog();
      const c = cat.census || {};
      const snap = cat.projected_from?.snapshot_id;
      el.innerHTML = `<h3>${icon('layers', 18)}Catalog census</h3>
<dl class="lr-census">${CENSUS.map((k) => `<div><dt>${esc(humanKey(k))}</dt><dd>${Number(c[k] ?? 0).toLocaleString()}</dd></div>`).join('')}${Object.entries(
        c.availability || {}
      )
        .map(
          ([k, v]) =>
            `<div><dt>${esc(humanKey(k))} units</dt><dd>${Number(v).toLocaleString()}</dd></div>`
        )
        .join('')}</dl>
${snap ? `<p class="lr-note">Readings: snapshot ${esc(snap.slice(0, 8))}</p>` : ''}
<p class="lr-note">Held and research records remain searchable as metadata. Their source bodies are excluded from readable exports.</p>
<div>${uiButton('lr-all-avail', 'Inspect all recorded availability', 'search', 'class="cm-btn cm-btn-outline"')}</div>`;
      el.querySelector('[data-ui="lr-all-avail"]').addEventListener('click', (e) => {
        e.stopPropagation();
        lib.go('/works?availability=all');
      });
    } catch {
      retry(el, 'The catalog census could not be loaded', census);
    }
  };

  let rows = [];
  let arts = {};
  const drawSources = () => {
    const el = $('[data-lr-sources]');
    const q = view.filter.trim().toLowerCase();
    const hits = q ? rows.filter((r) => `${r[1]} ${r[2]} ${r[0]}`.toLowerCase().includes(q)) : rows;
    const page = hits.slice(0, view.limit);
    el.innerHTML = `<h3>${icon('library', 18)}Sources</h3>
<p class="lr-note">One row per source file. Select a source for its recorded rights, required credits and notices.</p>
<div class="lr-filter"><input class="cm-input" type="search" placeholder="Filter sources by name or language" aria-label="Filter sources" value="${esc(view.filter)}" data-lr-filter></div>
${
  page.length
    ? `<div style="overflow-x:auto"><table class="lr-table"><thead><tr><th scope="col"><span class="sr-only">Artwork</span></th><th scope="col">Source</th><th scope="col">Language</th><th scope="col" class="num">Readable</th><th scope="col" class="num">Recorded</th></tr></thead><tbody>${page
        .map(
          (r) =>
            `<tr data-lr="${esc(r[0])}" tabindex="0" aria-selected="${view.current === r[0]}"><td>${
              r[5]
                ? `<img class="lr-thumb" src="${artSrc(r[5])}" alt="" loading="lazy" width="36" height="36">`
                : '<span class="lr-thumb cover" aria-hidden="true"></span>'
            }</td><td>${esc(r[1])}</td><td><span class="cm-chip">${esc(r[2])}</span></td><td class="num">${Number(r[3]).toLocaleString()}</td><td class="num">${Number(r[4]).toLocaleString()}</td></tr>`
        )
        .join('')}</tbody></table></div>
<p class="lr-note">${page.length.toLocaleString()} of ${hits.length.toLocaleString()} sources</p>
${hits.length > page.length ? uiButton('lr-more', 'Show more sources', 'chevron-down', 'class="cm-btn cm-btn-outline"') : ''}`
    : uiEmptyState({ title: 'No source matches this filter', text: 'Change or clear the filter.' })
}`;
  };
  const sources = async () => {
    const el = $('[data-lr-sources]');
    try {
      const c = await lib.collections();
      rows = c.collections || c.rows || [];
      drawSources();
    } catch {
      retry(el, 'The sources list could not be loaded', sources);
    }
  };
  const sourcesEl = $('[data-lr-sources]');
  let filterTimer = 0;
  sourcesEl.addEventListener('input', (e) => {
    if (!e.target.matches('[data-lr-filter]')) return;
    view.filter = e.target.value;
    view.limit = PAGE;
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
      const pos = e.target.selectionStart;
      drawSources();
      const input = sourcesEl.querySelector('[data-lr-filter]');
      input.focus();
      input.setSelectionRange(pos, pos);
    }, 120);
  });
  const pick = (tr) => {
    view.current = tr.dataset.lr;
    view.unit = null;
    sourcesEl
      .querySelectorAll('tr[data-lr]')
      .forEach((t) => t.setAttribute('aria-selected', String(t === tr)));
    detail();
  };
  sourcesEl.addEventListener('click', (e) => {
    const more = e.target.closest('[data-ui="lr-more"]');
    if (more) {
      e.stopPropagation();
      view.limit += PAGE;
      drawSources();
      return;
    }
    const tr = e.target.closest('tr[data-lr]');
    if (tr) pick(tr);
  });
  sourcesEl.addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr[data-lr]');
    if (tr && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      pick(tr);
    }
  });

  // The detail panel: the source's census, then the exact rights object of
  // one readable unit (the first in catalog order unless the viewer picks
  // another), with its sources.tsv rows, notices and metadata header.
  const detail = async () => {
    const el = $('[data-lr-detail]');
    const id = view.current;
    if (!id) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const row = rows.find((r) => r[0] === id);
    el.innerHTML = uiEmptyState({ title: 'Loading the source record' });
    try {
      const col = await lib.collection(id);
      if (view.current !== id) return;
      const readable = (col.rows || []).filter((r) => r[5] === 'readable');
      const unit =
        view.unit && readable.some((r) => r[0] === view.unit)
          ? view.unit
          : col.readable_ids?.[0] || readable[0]?.[0];
      const art = row?.[5] && arts[row[5]];
      let body = '';
      if (!unit) {
        body = uiEmptyState({
          title: 'No readable unit in this source',
          text: 'Its records stay searchable as metadata; the source body is excluded from reading and export.',
        });
      } else {
        const h = await lib.reading(unit);
        if (view.current !== id) return;
        const [rights, meta] = await Promise.all([
          rightsObject(lib, h.rights_ref),
          metadataObject(lib, h.metadata_ref),
        ]);
        if (view.current !== id) return;
        const srcRows = [...(rights.sources || []), ...(rights.file_sources || [])];
        const seen = new Set();
        const uniq = srcRows.filter((s) => {
          const k = JSON.stringify(s);
          return seen.has(k) ? false : seen.add(k);
        });
        body = `${
          readable.length > 1
            ? `<label class="lr-note" for="lr-unit">Rights of unit</label><select id="lr-unit" class="cm-select" data-lr-unit>${readable
                .slice(0, 250)
                .map(
                  (r) =>
                    `<option value="${esc(r[0])}"${r[0] === unit ? ' selected' : ''}>${esc(r[2])}</option>`
                )
                .join(
                  ''
                )}</select>${col.page_count > 1 || readable.length > 250 ? '<p class="lr-note">The first 250 readable units are listed; every unit carries its own record in the reader\'s Sources lens.</p>' : ''}`
            : ''
        }
<dl><dt>Unit</dt><dd>${esc(h.title || unit)}</dd><dt>Availability</dt><dd><span class="cm-status">${esc(rights.availability || 'readable')}</span></dd><dt>Source file</dt><dd><code>${esc(h.source_path || '')}</code></dd><dt>Source sha256</dt><dd><code>${esc(h.source_sha256 || '')}</code></dd><dt>Rights record</dt><dd><code>${esc(h.rights_ref.slice(0, 16))}</code></dd>${Object.entries(
          rights.layers || {}
        )
          .map(([k, v]) => `<dt>${esc(humanKey(k))}</dt><dd>${esc(String(v))}</dd>`)
          .join('')}</dl>
<h4>Required credits</h4>${list(rights.required_attribution)}
<h4>Admission</h4>${
          (rights.admission || []).length
            ? `<ul>${rights.admission.map((a) => `<li><strong>${esc(a.verdict || '')}</strong> · ${esc(a.source_id || '')}<br>${linkify(a.reason || '')}</li>`).join('')}</ul>`
            : '<p class="lr-note">None recorded.</p>'
        }
<h4>Source declarations</h4>${
          (rights.source_declarations || []).length
            ? `<ul>${rights.source_declarations.map((s) => `<li>${linkify(s)}</li>`).join('')}</ul>`
            : '<p class="lr-note">None recorded.</p>'
        }
${(rights.source_locators || []).length ? `<h4>Source locators</h4><ul>${rights.source_locators.map((s) => `<li>${linkify(s)}</li>`).join('')}</ul>` : ''}
<h4>Rights statements</h4>${
          uniq.length
            ? uniq
                .map(
                  (s) =>
                    `<dl>${[
                      'source_id',
                      'licence',
                      'jurisdiction',
                      'publication_year',
                      'pd_affirmed',
                      'contested',
                      'generated',
                      'publication_evidence',
                      'evidence',
                      'note',
                    ]
                      .filter((k) => s[k] !== undefined && s[k] !== '')
                      .map((k) => `<dt>${esc(humanKey(k))}</dt><dd>${linkify(String(s[k]))}</dd>`)
                      .join('')}</dl>`
                )
                .join(
                  '<hr style="border:0;border-top:1px solid var(--cm-border-subtle);margin:4px 0">'
                )
            : '<p class="lr-note">None recorded.</p>'
        }
${(rights.uncertainties || []).length ? `<h4>Uncertainties</h4>${list(rights.uncertainties)}` : ''}
${(rights.unresolved || []).length ? `<h4>Unresolved</h4>${list(rights.unresolved)}` : ''}
<h4>Notices</h4>${
          rights.notices.length
            ? rights.notices
                .map(
                  (n) =>
                    `<details class="cm-accordion lr-notice"><summary>Notice ${esc(n.sha256.slice(0, 12))}${n.scope ? ' · ' + esc(typeof n.scope === 'string' ? n.scope : JSON.stringify(n.scope)) : ''}</summary><pre>${esc(n.text || '')}</pre></details>`
                )
                .join('')
            : '<p class="lr-note">No notice applies to this unit.</p>'
        }
${
  meta
    ? `<details class="cm-accordion"><summary>Recorded metadata header</summary><dl>${Object.entries(
        meta
      )
        .map(
          ([k, v]) =>
            `<dt>${esc(humanKey(k))}</dt><dd>${Array.isArray(v) ? v.map((x) => linkify(String(x))).join('<br>') : linkify(typeof v === 'string' ? v : JSON.stringify(v))}</dd>`
        )
        .join('')}</dl></details>`
    : ''
}
<div>${uiButton('lr-read', 'Open this reading', 'book-open', `class="cm-btn cm-btn-outline" data-id="${esc(unit)}"`)}</div>`;
      }
      el.innerHTML = `<h3>${art ? `<img class="lr-thumb" src="${artSrc(art.id)}" alt="">` : ''}${esc(row?.[1] || id)}</h3>
<p class="lr-note">${row ? `${esc(row[2])} · ${Number(row[3]).toLocaleString()} readable · ${Number(row[4]).toLocaleString()} recorded units` : ''}</p>
${art ? `<p class="lr-note">Artwork: ${esc(art.credit)} <a href="${esc(art.source)}" target="_blank" rel="noopener noreferrer">Source</a></p>` : ''}
${body}
<div style="display:flex;gap:8px;flex-wrap:wrap">${
        readable.length
          ? uiButton(
              'lr-select-src',
              'Select readable units',
              'plus',
              'class="cm-btn cm-btn-tonal"'
            )
          : ''
      }${uiButton('lr-open-col', 'Open collection', 'library', 'class="cm-btn cm-btn-outline"')}${uiButton('lr-close', 'Close', 'x', 'class="cm-btn cm-btn-outline"')}</div>`;
      el.querySelector('[data-lr-unit]')?.addEventListener('change', (e) => {
        view.unit = e.target.value;
        detail();
      });
      el.onclick = (e) => {
        const b = e.target.closest('[data-ui]');
        if (!b) return;
        e.stopPropagation();
        const a = b.dataset.ui;
        if (a === 'lr-read') lib.go('/read/' + b.dataset.id);
        else if (a === 'lr-open-col') lib.go('/collections/' + id);
        else if (a === 'lr-close') {
          view.current = null;
          el.hidden = true;
          sourcesEl
            .querySelectorAll('tr[aria-selected="true"]')
            .forEach((t) => t.setAttribute('aria-selected', 'false'));
        } else if (a === 'lr-select-src') {
          const all = col.readable_ids || readable.map((r) => r[0]);
          for (const u of all) lib.selection.add(u);
          showToast(
            `Added ${all.length.toLocaleString()} readable unit${all.length === 1 ? '' : 's'} to the export selection.`,
            'success'
          );
        }
      };
      el.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    } catch (e) {
      if (view.current !== id) return;
      console.error('[library rights]', e);
      retry(el, 'This source record could not be loaded', detail);
    }
  };

  const artwork = async () => {
    const el = $('[data-lr-art]');
    try {
      const a = (await lib.artwork()).artwork || [];
      arts = Object.fromEntries(a.map((x) => [x.id, x]));
      el.innerHTML = `<h3>${icon('file-text', 18)}Artwork credits</h3>
<p class="lr-note">Collection artwork is historical and credited here; it is in no export package.</p>
${a
  .map(
    (x) =>
      `<div class="lr-art"><img src="${artSrc(x.id)}" alt="${esc(x.title)}" loading="lazy" width="72" height="72"><p style="margin:0"><strong>${esc(x.title)}</strong> · ${esc(x.author)}<br>${esc(x.credit)}<small>${esc(x.note || '')}</small><a href="${esc(x.source)}" target="_blank" rel="noopener noreferrer">Source ${icon('link', 12)}</a></p></div>`
  )
  .join('')}`;
    } catch {
      retry(el, 'Artwork credits could not be loaded', artwork);
    }
  };

  // The method reference belongs to the analysis chunk (contract); it is
  // loaded only when opened.
  const methods = () => {
    const el = $('[data-lr-methods]');
    el.innerHTML = `<details class="cm-accordion" data-lr-methods-acc><summary>Method reference</summary><div data-lr-methods-body></div></details>`;
    el.querySelector('details').addEventListener(
      'toggle',
      async (e) => {
        if (!e.target.open) return;
        const body = el.querySelector('[data-lr-methods-body]');
        if (body.dataset.loaded) return;
        body.dataset.loaded = '1';
        body.innerHTML = uiEmptyState({ title: 'Loading the method reference' });
        try {
          const analysis = await libraryChunk('analysis');
          if (typeof analysis.methodReference === 'function')
            await analysis.methodReference(body, lib);
          else
            body.innerHTML = uiEmptyState({
              title: 'The method reference is not available in this build',
            });
        } catch {
          delete body.dataset.loaded;
          body.innerHTML = uiEmptyState({
            title: 'The method reference could not be loaded',
            text: 'Close and reopen to retry.',
            tone: 'danger',
          });
        }
      },
      false
    );
  };

  census();
  methods();
  await Promise.all([sources(), artwork()]);
  if (view.current) detail();
}

return { show, exportPanel };

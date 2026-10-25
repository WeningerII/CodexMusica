// ─── Library chunk: works ──────────────────────────────────────────────────
// Wrapped by the build as CMLibraryDefine('works', function () { … }).
// The Works view (docs/library-ui-contract.md): a 50-row table of reading
// units, the search field, the filters sheet and the metadata sheet. Ported
// from sites/library/components/library/library-app.tsx (Works, search,
// filter and metadata parts).
//
// Where rows come from:
//   - the default list (availability=readable, sort=title, nothing else) is
//     static: w/title/<k>.json.gz, 100 rows per file in the Worker's order;
//   - one collection with no other filter is static too: c/<id>.json.gz (rows
//     0-249) and its .p<k> pages of 250;
//   - anything else asks Render: GET /search with the Worker's parameters
//     (mcp/library_search.js), limit 50.
// Static rows are [reading_unit_id, rev16-proj12, title, contributors,
// language, availability, completeness, edition8, work8, source_path,
// snippet, contributor_search]; search items are compact summaries. Both
// become one row shape below.
/* global esc, icon, showToast, uiEmptyState, uiSubroute */
'use strict';

const PAGE = 50;
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
const AVAILABILITY = ['readable', 'all', 'held', 'metadata_only', 'research_only', 'rejected'];
const COMPLETENESS = [
  'all',
  'complete_poem',
  'source_item',
  'documented_excerpt',
  'continuous_segment',
];
const CLOSED = {
  availability: AVAILABILITY,
  completeness: COMPLETENESS,
  sort: ['title', 'contributor'],
};
// The list parameters and their defaults; a default is left out of the hash.
const DEFAULTS = {
  q: '',
  language: 'all',
  availability: 'readable',
  completeness: 'all',
  contributor: '',
  sort: 'title',
  offset: '0',
  collection: '',
};

const STYLE = `
#surface-library .lw{display:flex;flex-direction:column;gap:16px;padding:16px 0 32px;color:var(--cm-text)}
#surface-library .lw-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#surface-library .lw-top .cm-search{flex:1 1 280px;height:44px}
#surface-library .lw-search-clear{display:none}
#surface-library .lw-top.has-q .lw-search-clear{display:inline-flex}
#surface-library .lw-top kbd{white-space:nowrap;font:12px var(--cm-font);color:var(--cm-text-muted);border:1px solid var(--cm-border);border-radius:6px;padding:1px 6px}
#surface-library .lw-top.has-q kbd{display:none}
#surface-library .lw-count[hidden]{display:none}
#surface-library .lw-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#surface-library .lw-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:var(--cm-accent);color:var(--cm-on-accent);font-size:12px}
#surface-library .lw-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
#surface-library .lw-head h2{margin:0;font-size:22px;font-weight:600}
#surface-library .lw-head p{margin:4px 0 0;color:var(--cm-text-secondary);font-size:14px}
#surface-library .lw-chips{display:flex;gap:6px;flex-wrap:wrap}
#surface-library .lw-chips .cm-chip{gap:4px}
#surface-library .lw-scroll{overflow-x:auto;border:1px solid var(--cm-border);border-radius:var(--cm-radius-lg);background:var(--cm-surface)}
#surface-library .lw-table{width:100%;border-collapse:collapse;font-size:14px}
#surface-library .lw-table th{text-align:left;font-weight:600;font-size:12px;letter-spacing:.02em;color:var(--cm-text-secondary);padding:10px 12px;border-bottom:1px solid var(--cm-border);background:var(--cm-surface-subtle)}
#surface-library .lw-table td{padding:10px 12px;border-bottom:1px solid var(--cm-border-subtle);vertical-align:top}
#surface-library .lw-table tr:last-child td{border-bottom:0}
#surface-library .lw-table tbody tr:hover{background:var(--cm-hover)}
#surface-library .lw-title{display:flex;gap:10px;align-items:flex-start;text-align:left;border:0;background:none;padding:0;color:var(--cm-text);font:inherit;cursor:pointer;width:100%}
#surface-library .lw-title svg{flex:none;margin-top:2px;color:var(--cm-text-muted)}
#surface-library .lw-title strong{display:block;font-weight:600;color:var(--cm-link)}
#surface-library .lw-title:hover strong{text-decoration:underline}
#surface-library .lw-title small,#surface-library .lw-ids,#surface-library .lw-table td small{display:block;color:var(--cm-text-muted);font-size:12px;margin-top:2px;overflow-wrap:anywhere}
#surface-library .lw-title small{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#surface-library .lw-ids{margin-left:28px;font-variant-numeric:tabular-nums}
#surface-library .lw-badge{display:inline-block;padding:1px 8px;border-radius:10px;font-size:12px;background:var(--cm-surface-sunken);color:var(--cm-text-secondary);border:1px solid var(--cm-border)}
#surface-library .lw-badge[data-a=readable]{background:var(--cm-success-soft);color:var(--cm-success-text);border-color:transparent}
#surface-library .lw-badge[data-a=held]{background:var(--cm-warning-soft);color:var(--cm-warning-text);border-color:transparent}
#surface-library .lw-actions{white-space:nowrap;text-align:right;width:1%}
#surface-library .lw-actions .cm-btn{min-height:36px;min-width:36px;padding:6px}
#surface-library .lw-actions .cm-btn[aria-pressed=true]{color:var(--cm-accent-text);background:var(--cm-accent-soft)}
#surface-library .lw-pager{display:flex;justify-content:center;align-items:center;gap:12px;color:var(--cm-text-secondary);font-size:14px;font-variant-numeric:tabular-nums}
#surface-library .lw-results[aria-busy=true]{opacity:.6}
#surface-library .lw-scrim{position:fixed;inset:0;z-index:900}
#surface-library .lw-sheet{position:fixed;top:0;right:0;bottom:0;z-index:901;width:min(420px,100vw);display:flex;flex-direction:column;border-radius:var(--cm-radius-lg) 0 0 var(--cm-radius-lg);overflow:auto}
#surface-library .lw-sheet header{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:16px 16px 8px}
#surface-library .lw-sheet h2{margin:0;font-size:18px;font-weight:600;overflow-wrap:anywhere}
#surface-library .lw-sheet header p{margin:4px 0 0;color:var(--cm-text-secondary);font-size:13px}
#surface-library .lw-sheet-body{display:flex;flex-direction:column;gap:14px;padding:8px 16px 24px}
#surface-library .lw-sheet label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:500;color:var(--cm-text-secondary)}
#surface-library .lw-sheet .cm-select,#surface-library .lw-sheet .cm-input{width:100%}
#surface-library .lw-sheet .cm-btn-primary{width:100%}
#surface-library .lw-note{color:var(--cm-text-secondary);font-size:13px;margin:0}
#surface-library .lw-dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 12px;margin:0;font-size:13px}
#surface-library .lw-dl dt{color:var(--cm-text-muted)}
#surface-library .lw-dl dd{margin:0;overflow-wrap:anywhere}
#surface-library .lw-value{font-size:13px}
#surface-library .lw-value details{margin:2px 0 2px 8px;border-left:2px solid var(--cm-border-subtle);padding-left:8px}
#surface-library .lw-value summary{cursor:pointer;color:var(--cm-text-secondary)}
#surface-library .lw-value .lw-unknown{color:var(--cm-text-muted);font-style:italic}
#surface-library .lw-value .lw-yes{color:var(--cm-success-text)}
#surface-library .lw-value .lw-kv{display:grid;grid-template-columns:max-content 1fr;gap:4px 10px}
#surface-library .lw-value .lw-kv>span:nth-child(odd){color:var(--cm-text-muted)}
#surface-library .lw-value .lw-kv>*{overflow-wrap:anywhere;min-width:0}
@media (max-width:720px){
#surface-library .lw-top kbd{display:none}
#surface-library .lw-table thead{display:none}
#surface-library .lw-table,#surface-library .lw-table tbody,#surface-library .lw-table tr,#surface-library .lw-table td{display:block;width:auto}
#surface-library .lw-table tr{position:relative;padding:8px 0;border-bottom:1px solid var(--cm-border-subtle)}
#surface-library .lw-table td{border:0;padding:2px 12px 2px 40px}
#surface-library .lw-table td:first-child{padding-left:12px;padding-right:96px}
#surface-library .lw-table td.lw-actions{position:absolute;top:8px;right:8px;padding:0}
#surface-library .lw-sheet{width:100vw;border-radius:0}
}`;

function injectStyle() {
  if (!document.querySelector('style[data-lib="works"]'))
    document.head.insertAdjacentHTML('beforeend', `<style data-lib="works">${STYLE}</style>`);
}

const ic = (lib, name, size = 18) => (lib && lib.icon && lib.icon(name, size)) || icon(name, size);
let LIB = null;
const languageName = (id) =>
  (LIB && LIB.languageName && LIB.languageName(id)) || LANGUAGE_NAMES[id] || id || 'Unknown';
const words = (s) => String(s || '').replace(/_/g, ' ');

// ─── Route ↔ state ──────────────────────────────────────────────────────────
// '/works?q=…' or '/collections/<id>' (core may hand a collection here).
function parse(sub) {
  const at = sub.indexOf('?');
  const path = at < 0 ? sub : sub.slice(0, at);
  const p = new URLSearchParams(at < 0 ? '' : sub.slice(at + 1));
  const s = {};
  for (const k of Object.keys(DEFAULTS)) s[k] = p.get(k) ?? DEFAULTS[k];
  const m = /^\/collections\/(.+)$/.exec(path);
  if (m) s.collection = decodeURIComponent(m[1]);
  // A value outside a closed set reads as the default, never half-applied
  // (the chip, the filter sheet and the request each read it differently;
  // BB8's L2). update() writes the result back to the hash. A language is
  // checked against the catalog there; here only its shape.
  for (const [k, set] of Object.entries(CLOSED)) if (!set.includes(s[k])) s[k] = DEFAULTS[k];
  if (s.language !== 'all' && !/^[a-z]{2,3}$/.test(s.language)) s.language = DEFAULTS.language;
  // Offsets sit on the 50-row grid the pager produces, so a page never spans
  // two 100-row w/title files (an offset of 75 used to skip rows 101-125; L3).
  const n = Math.max(0, Math.floor(Number(s.offset) || 0));
  s.offset = String(n - (n % PAGE));
  s.base = m ? path : '/works';
  return s;
}
function format(s) {
  const p = new URLSearchParams();
  for (const [k, d] of Object.entries(DEFAULTS)) {
    if (k === 'collection' && s.base !== '/works') continue;
    if (s[k] && s[k] !== d) p.set(k, s[k]);
  }
  const q = p.toString();
  return s.base + (q ? '?' + q : '');
}
const isStatic = (s) =>
  !s.q.trim() &&
  s.language === 'all' &&
  s.availability === 'readable' &&
  s.completeness === 'all' &&
  !s.contributor.trim() &&
  s.sort === 'title';

// ─── Rows ───────────────────────────────────────────────────────────────────
function fromStatic(r) {
  return {
    reading_unit_id: r[0],
    path_key: r[1],
    title: r[2],
    contributors: (r[3] || []).map((c) => (Array.isArray(c) ? { name: c[0], role: c[1] } : c)),
    language: r[4],
    availability: r[5],
    completeness: r[6],
    edition_id: r[7] || '',
    work_id: r[8] || '',
    source_path: r[9],
    snippet: r[10],
    contributor_search: r[11],
    search_hit: null,
  };
}
const fromSearch = (item) => ({
  ...item,
  path_key: item.path_key || item.reading_path_key || '',
  edition_id: item.edition_id || '',
  work_id: item.work_id || '',
});

async function staticPage(s, lib) {
  const offset = Number(s.offset);
  if (s.collection) {
    // An id the collection list does not hold names no collection: said as
    // such, without asking for a head file that is not there.
    const list = await lib.collections().catch(() => null);
    const ids = Array.isArray(list) ? list : list?.collections;
    if (
      Array.isArray(ids) &&
      !ids.some((c) => (Array.isArray(c) ? c[0] : c.collection_id) === s.collection)
    ) {
      const none = Error('No such collection');
      none.code = 'NO_COLLECTION';
      throw none;
    }
    let head;
    try {
      head = await lib.collection(s.collection);
    } catch (error) {
      // No head file: the id names no collection. Said as such, not as a
      // load failure whose Retry could only ask for the same missing file.
      if (!error || error.status !== 404) throw error;
      const none = Error('No such collection');
      none.code = 'NO_COLLECTION';
      throw none;
    }
    // Past the end: an empty page, which load() shows as past the end with
    // First page, rather than a request for a page file that does not exist.
    if (offset >= (head.total || 0))
      return { rows: [], total: head.total || 0, readableIds: head.readable_ids };
    const k = Math.floor(offset / 250);
    const page = k === 0 ? head : await lib.collection(s.collection, k);
    const start = offset - k * 250;
    let rows = page.rows.slice(start, start + PAGE);
    // A page boundary inside the 50: the rest comes from the next file.
    if (rows.length < PAGE && start + PAGE > 250 && k + 1 < (head.page_count || 1)) {
      const next = await lib.collection(s.collection, k + 1);
      rows = rows.concat(next.rows.slice(0, PAGE - rows.length));
    }
    return { rows: rows.map(fromStatic), total: head.total, readableIds: head.readable_ids };
  }
  const k = Math.floor(offset / 100);
  // Past the end of the list (a shared or hand-edited link): an empty page,
  // which load() shows as past the end with First page, rather than a request
  // for a title file that does not exist. The static list is the readable
  // units, so the catalog's census carries its total.
  if (k > 0) {
    const total = (await lib.catalog().catch(() => null))?.census?.readable_reading_units;
    if (Number.isInteger(total) && offset >= total) return { rows: [], total };
  }
  const file = await lib.json(`w/title/${k}.json.gz`);
  const start = offset - k * 100;
  return { rows: file.rows.slice(start, start + PAGE).map(fromStatic), total: file.total };
}
async function searchPage(s, lib) {
  const p = new URLSearchParams();
  if (s.q.trim()) p.set('q', s.q);
  for (const k of ['language', 'availability', 'completeness'])
    if (s[k] && s[k] !== 'all') p.set(k, s[k]);
  if (s.availability === 'all') p.set('availability', 'all');
  if (s.collection) p.set('collection', s.collection);
  if (s.contributor.trim()) p.set('contributor', s.contributor);
  if (s.sort !== 'title') p.set('sort', s.sort);
  if (s.offset !== '0') p.set('offset', s.offset);
  p.set('limit', String(PAGE));
  const r = await lib.get('/search?' + p.toString());
  return { rows: (r.items || []).map(fromSearch), total: r.total || 0, next: r.next_offset };
}

// ─── View ───────────────────────────────────────────────────────────────────
// One live view per main element; show() for a changed list sub updates it in
// place so the search field keeps focus and caret while typing.
const VIEWS = new WeakMap();
let ACTIVE = null;

function shell(lib) {
  return (
    `<div class="lw" data-lib-view="works">` +
    `<div class="lw-top">` +
    `<label class="cm-search">${ic(lib, 'search', 18)}<input type="search" data-lw="q" placeholder="Search titles, authors, or exact phrases" aria-label="Search Library" autocomplete="off" spellcheck="false"><button type="button" class="cm-btn cm-btn-icon lw-search-clear" data-lw="clear-q" aria-label="Clear search">${ic(lib, 'x', 16)}</button><kbd aria-hidden="true">⌘ K</kbd></label>` +
    `<button type="button" class="cm-btn cm-btn-outline" data-lw="filters" aria-haspopup="dialog" aria-label="Filter Library">${ic(lib, 'sliders-horizontal', 18)}<span>Filter</span><span class="lw-count" data-lw-slot="filter-count" hidden></span></button>` +
    `</div>` +
    `<div class="lw-head"><div><h2 data-lw-slot="title">Works</h2><p data-lw-slot="summary"> </p></div><div class="lw-chips" data-lw-slot="chips"></div></div>` +
    `<div class="lw-results" data-lw-slot="results" aria-live="polite"></div>` +
    `<div data-lw-slot="layer"></div>` +
    `</div>`
  );
}

function rowHTML(r, lib) {
  const id = r.reading_unit_id;
  const readable = r.availability === 'readable';
  const on = lib.selection && lib.selection.ids.has(id);
  const title = r.title || r.source_path?.split('/').pop() || 'Untitled reading';
  const who =
    r.contributor_search ||
    (r.contributors || []).map((c) => c.name).join(', ') ||
    'Source contributor unknown';
  const ids =
    r.edition_id || r.work_id
      ? `<small class="lw-ids">Edition ${esc(String(r.edition_id).slice(-8))} · work ${esc(String(r.work_id).slice(-8))}</small>`
      : '';
  return (
    `<tr data-id="${esc(id)}">` +
    `<td><button type="button" class="lw-title" data-lw="open" data-id="${esc(id)}" aria-label="${esc((readable ? 'Read ' : 'Show the record of ') + title)}">${ic(lib, readable ? 'book-open' : 'info', 18)}<span dir="auto"><strong>${esc(title)}</strong><small dir="auto">${esc(r.snippet || r.source_path || '')}</small></span></button>${ids}</td>` +
    `<td dir="auto">${esc(who)}</td>` +
    `<td>${esc(languageName(r.language))}</td>` +
    `<td><span class="lw-badge" data-a="${esc(r.availability)}">${esc(words(r.availability))}</span><small>${esc(words(r.completeness))}</small></td>` +
    `<td class="lw-actions"><button type="button" class="cm-btn" data-lw="meta" data-id="${esc(id)}" aria-label="${esc('Record of ' + title)}" title="Source record">${ic(lib, 'info', 18)}</button>` +
    `<button type="button" class="cm-btn" data-lw="select" data-id="${esc(id)}" aria-pressed="${on ? 'true' : 'false'}" ${readable ? '' : 'disabled'} aria-label="${esc(`${on ? 'Remove' : 'Add'} ${title} ${on ? 'from' : 'to'} export selection`)}" title="${readable ? (on ? 'Remove from selection' : 'Add to selection') : 'Only readable units can be exported'}">${ic(lib, on ? 'check' : 'plus', 18)}</button></td>` +
    `</tr>`
  );
}

class WorksView {
  constructor(main, lib) {
    this.main = main;
    this.lib = lib;
    this.seq = 0;
    this.rows = [];
    this.timer = 0;
    injectStyle();
    main.innerHTML = shell(lib);
    main.dataset.libraryChunk = 'works';
    this.root = main.querySelector('.lw');
    this.input = main.querySelector('[data-lw="q"]');
    this.slot = (n) => main.querySelector(`[data-lw-slot="${n}"]`);
    this.root.addEventListener('click', (e) => this.click(e));
    this.input.addEventListener('input', () => {
      this.state.q = this.input.value;
      this.state.offset = '0';
      this.root.querySelector('.lw-top').classList.toggle('has-q', !!this.input.value);
      clearTimeout(this.timer);
      // The Site's 200 ms debounce; q and filters replace the entry.
      this.timer = setTimeout(() => this.commit(false), 200);
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(this.timer);
        this.commit(false);
      }
    });
    this.keys = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && this.root.isConnected) {
        e.preventDefault();
        this.input.focus();
        this.input.select();
      } else if (e.key === 'Escape' && this.root.isConnected && this.escape()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', this.keys, true);
    if (lib.selection && lib.selection.onChange)
      this.unsub = lib.selection.onChange(() => this.root.isConnected && this.paintSelection());
  }
  dispose() {
    document.removeEventListener('keydown', this.keys, true);
    if (typeof this.unsub === 'function') this.unsub();
  }
  // Write the state to the hash (push for paging, replace for q and filters)
  // and load.
  commit(push) {
    // A user's own change supersedes an update() still waiting on the catalog.
    this.generation = (this.generation || 0) + 1;
    const sub = format(this.state);
    this.sub = sub;
    if (this.lib.go) this.lib.go(sub, { replace: !push });
    else uiSubroute(sub, { push });
    // lib.go may re-enter show(); that call sees the same sub and stays put.
    this.load();
  }
  async update(sub) {
    const gen = (this.generation = (this.generation || 0) + 1);
    const s = parse(sub);
    if (s.language !== 'all' && !(await this.languages()).includes(s.language))
      s.language = DEFAULTS.language;
    // A later navigation (or the user's own change) arrived while the catalog
    // loaded: this one is stale and must not overwrite its state or the hash
    // (Jony's review: language=eng then offset=50 with a slow catalog).
    // Left for another Library page meanwhile (BB8's L4): nothing to update.
    if (gen !== this.generation || !this.root.isConnected) return;
    this.state = s;
    this.sub = format(s);
    // What is shown is what the hash says: a value read as its default is
    // dropped from the hash (replace, not a new history entry).
    if (sub !== this.sub) {
      if (this.lib.go) this.lib.go(this.sub, { replace: true });
      else uiSubroute(this.sub, { push: false });
    }
    if (document.activeElement !== this.input || this.input.value !== s.q) this.input.value = s.q;
    this.root.querySelector('.lw-top').classList.toggle('has-q', !!s.q);
    this.load();
  }
  filterCount() {
    const s = this.state;
    return ['language', 'availability', 'completeness', 'contributor', 'sort'].filter(
      (k) => s[k] && s[k] !== DEFAULTS[k]
    ).length;
  }
  async paintHead() {
    const s = this.state;
    const count = this.filterCount();
    const badge = this.slot('filter-count');
    badge.hidden = !count;
    badge.textContent = count ? String(count) : '';
    let title = 'Works';
    if (s.collection) {
      title = 'Collection';
      try {
        const rows = await this.lib.collections();
        const list = Array.isArray(rows) ? rows : rows?.collections || [];
        const row = list.find((c) => (Array.isArray(c) ? c[0] : c.collection_id) === s.collection);
        if (row) title = Array.isArray(row) ? row[1] : row.title;
      } catch {
        /* the heading keeps 'Collection' */
      }
    }
    this.slot('title').textContent = title;
    const chips = [];
    if (s.collection && s.base === '/works') chips.push(['collection', 'In one collection']);
    if (s.availability !== 'readable')
      chips.push(['availability', 'Availability: ' + words(s.availability)]);
    if (s.language !== 'all') chips.push(['language', languageName(s.language)]);
    if (s.completeness !== 'all') chips.push(['completeness', words(s.completeness)]);
    if (s.contributor) chips.push(['contributor', 'Contributor: ' + s.contributor]);
    if (s.sort !== 'title') chips.push(['sort', 'Sorted by contributor']);
    this.slot('chips').innerHTML =
      chips
        .map(
          ([k, label]) =>
            `<button type="button" class="cm-chip" data-lw="drop" data-k="${k}" aria-label="${esc('Remove filter ' + label)}">${esc(label)}${ic(this.lib, 'x', 14)}</button>`
        )
        .join('') +
      (s.collection && this.page?.readableIds?.length
        ? `<button type="button" class="cm-btn cm-btn-tonal" data-lw="select-collection">${ic(this.lib, 'plus', 16)}<span>Select collection</span></button>`
        : '');
  }
  async load() {
    const s = { ...this.state };
    const seq = ++this.seq;
    const results = this.slot('results');
    results.setAttribute('aria-busy', 'true');
    if (!this.rows.length) results.innerHTML = uiEmptyState({ title: 'Loading works…' });
    this.paintHead();
    let page;
    try {
      page = isStatic(s) ? await staticPage(s, this.lib) : await searchPage(s, this.lib);
    } catch (error) {
      if (seq !== this.seq || !this.root.isConnected) return;
      results.removeAttribute('aria-busy');
      this.rows = [];
      if (error && error.code === 'NO_COLLECTION') {
        results.innerHTML = uiEmptyState({
          title: 'No such collection',
          text: `This Library has no collection “${esc(s.collection)}”.`,
          actions: `<button type="button" class="cm-btn cm-btn-outline" data-lw="all-works">Browse all works</button>`,
        });
        this.slot('summary').textContent = '';
        return;
      }
      const rate = error && (error.status === 429 || error.code === 'RATE_LIMITED');
      results.innerHTML = uiEmptyState({
        title: isStatic(s) ? 'The Library list could not load' : 'Search is unavailable right now',
        text: rate
          ? 'Too many searches from this network; retry shortly.'
          : (error && error.message) || 'Check your connection and retry.',
        actions: `<button type="button" class="cm-btn cm-btn-outline" data-lw="retry">${ic(this.lib, 'refresh-cw', 16)}<span>Retry</span></button>`,
        tone: 'danger',
      });
      this.slot('summary').textContent = '';
      return;
    }
    // Superseded, or the view left the page while the rows loaded (a slow
    // catalog holds every static read): nothing to paint.
    if (seq !== this.seq || !this.root.isConnected) return;
    this.page = page;
    this.rows = page.rows;
    results.removeAttribute('aria-busy');
    this.paintHead();
    const offset = Number(s.offset);
    this.slot('summary').textContent =
      `${page.total.toLocaleString()} reading units · work and edition identities remain distinct`;
    if (!page.total || !page.rows.length) {
      results.innerHTML = uiEmptyState({
        title: offset && page.total ? 'No more readings on this page' : 'No matching readings',
        text: 'Search is literal and accent-preserving. Try a recorded title, contributor or exact phrase.',
        actions:
          offset && page.total
            ? `<button type="button" class="cm-btn cm-btn-outline" data-lw="page" data-to="0">First page</button>`
            : this.filterCount() || s.q
              ? `<button type="button" class="cm-btn cm-btn-outline" data-lw="clear-all">Clear search and filters</button>`
              : '',
      });
      return;
    }
    const last = Math.min(offset + page.rows.length, page.total);
    const hasNext = page.next !== undefined ? page.next !== null : last < page.total;
    results.innerHTML =
      `<div class="lw-scroll"><table class="lw-table"><thead><tr><th scope="col">Work / reading</th><th scope="col">Contributor</th><th scope="col">Language</th><th scope="col">Scope / availability</th><th scope="col"><span class="lw-sr">Record and export selection</span></th></tr></thead><tbody>` +
      page.rows.map((r) => rowHTML(r, this.lib)).join('') +
      `</tbody></table></div>` +
      `<nav class="lw-pager" aria-label="Works pages"><button type="button" class="cm-btn cm-btn-outline" data-lw="page" data-to="${Math.max(0, offset - PAGE)}" ${offset === 0 ? 'disabled' : ''}>Previous</button>` +
      `<span>${(offset + 1).toLocaleString()}–${last.toLocaleString()} of ${page.total.toLocaleString()}</span>` +
      `<button type="button" class="cm-btn cm-btn-outline" data-lw="page" data-to="${page.next ?? offset + PAGE}" ${hasNext ? '' : 'disabled'}>Next</button></nav>`;
  }
  paintSelection() {
    for (const b of this.root.querySelectorAll('[data-lw="select"]')) {
      const on = this.lib.selection.ids.has(b.dataset.id);
      if ((b.getAttribute('aria-pressed') === 'true') === on) continue;
      const row = this.rows.find((r) => r.reading_unit_id === b.dataset.id);
      const title = row?.title || 'this reading';
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute(
        'aria-label',
        `${on ? 'Remove' : 'Add'} ${title} ${on ? 'from' : 'to'} export selection`
      );
      b.title = on ? 'Remove from selection' : 'Add to selection';
      b.innerHTML = ic(this.lib, on ? 'check' : 'plus', 18);
    }
  }
  openReading(r) {
    const p = new URLSearchParams();
    if (r.path_key) p.set('revision', r.path_key);
    const hit = r.search_hit;
    if (hit && hit.line_id) {
      p.set('line', String(hit.line_id));
      p.set('offset', String(hit.row_offset ?? 0));
      if (Array.isArray(hit.normalized_cp_range)) {
        p.set('span', hit.normalized_cp_range.join(':'));
        p.set('precision', String(hit.precision || 'span'));
      }
    }
    const q = p.toString();
    const scroll = window.scrollY;
    try {
      history.replaceState({ ...(history.state || {}), libScroll: scroll, libPrev: true }, '');
    } catch {
      /* file:// */
    }
    this.lib.go(`/read/${encodeURIComponent(r.reading_unit_id)}${q ? '?' + q : ''}`);
  }
  click(e) {
    const t = e.target.closest('[data-lw]');
    if (!t || t.disabled) return;
    const s = this.state;
    const act = t.dataset.lw;
    const row = () => this.rows.find((r) => r.reading_unit_id === t.dataset.id);
    if (act === 'open') {
      const r = row();
      if (!r) return;
      if (r.availability === 'readable') this.openReading(r);
      else
        openMetadata(this.lib, r.reading_unit_id, { opener: t, row: r, layer: this.slot('layer') });
    } else if (act === 'meta') {
      const r = row();
      openMetadata(this.lib, t.dataset.id, { opener: t, row: r, layer: this.slot('layer') });
    } else if (act === 'select') {
      const sel = this.lib.selection;
      if (sel.ids.has(t.dataset.id)) sel.remove(t.dataset.id);
      else sel.add(t.dataset.id);
      this.paintSelection();
    } else if (act === 'select-collection') {
      const ids = this.page?.readableIds || [];
      for (const id of ids) this.lib.selection.add(id);
      this.paintSelection();
      if (typeof showToast === 'function')
        showToast(
          `${ids.length.toLocaleString()} readable units added to the selection`,
          'success'
        );
    } else if (act === 'page') {
      s.offset = String(Math.max(0, Number(t.dataset.to) || 0));
      this.commit(true);
      this.root.scrollIntoView?.({ block: 'start' });
    } else if (act === 'clear-q') {
      this.input.value = '';
      s.q = '';
      s.offset = '0';
      this.root.querySelector('.lw-top').classList.remove('has-q');
      this.input.focus();
      this.commit(false);
    } else if (act === 'clear-all') {
      Object.assign(s, { ...DEFAULTS, collection: s.base === '/works' ? '' : s.collection });
      this.input.value = '';
      this.root.querySelector('.lw-top').classList.remove('has-q');
      this.commit(false);
    } else if (act === 'drop') {
      s[t.dataset.k] = DEFAULTS[t.dataset.k];
      s.offset = '0';
      this.commit(false);
    } else if (act === 'filters') {
      this.openFilters(t);
    } else if (act === 'retry') {
      this.load();
    } else if (act === 'all-works') {
      Object.assign(s, { collection: '', offset: '0', base: '/works' });
      this.commit(false);
    }
  }
  // The full recorded-language list (every collection, held ones too).
  async languages() {
    try {
      const cat = await this.lib.catalog();
      if (Array.isArray(cat?.languages) && cat.languages.length) return cat.languages;
    } catch {
      /* fall back to the known names */
    }
    return Object.keys(LANGUAGE_NAMES);
  }
  async openFilters(opener) {
    const s = this.state;
    const languages = await this.languages();
    const opt = (v, label, cur) =>
      `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
    const body =
      `<label>Language<select class="cm-select" data-f="language">${opt('all', 'All recorded languages', s.language)}${languages
        .map((id) => opt(id, languageName(id), s.language))
        .join('')}</select></label>` +
      `<label>Availability<select class="cm-select" data-f="availability">${AVAILABILITY.map((a) => opt(a, words(a), s.availability)).join('')}</select></label>` +
      `<label>Completeness<select class="cm-select" data-f="completeness">${COMPLETENESS.map((a) => opt(a, words(a), s.completeness)).join('')}</select></label>` +
      `<label>Contributor<input class="cm-input" data-f="contributor" value="${esc(s.contributor)}" autocomplete="off"></label>` +
      `<label>Sort<select class="cm-select" data-f="sort">${opt('title', 'Title', s.sort)}${opt('contributor', 'Contributor, then title', s.sort)}</select></label>` +
      `<p class="lw-note">Held and research records remain searchable as metadata. Their source bodies are excluded from readable exports.</p>` +
      `<button type="button" class="cm-btn cm-btn-outline" data-f-act="inspect-all">Inspect all recorded availability</button>` +
      `<button type="button" class="cm-btn cm-btn-primary" data-f-act="apply">Apply filters</button>` +
      `<button type="button" class="cm-btn" data-f-act="clear">Clear filters</button>`;
    const sheet = openSheet(this.slot('layer'), {
      title: 'Filter Library',
      text: 'Filter recorded metadata and readable source text.',
      body,
      opener,
      lib: this.lib,
      kind: 'filters',
    });
    const read = () => {
      for (const el of sheet.querySelectorAll('[data-f]')) s[el.dataset.f] = el.value;
      s.offset = '0';
    };
    // Each change applies at once, as the Site's controls did.
    sheet.addEventListener('change', (e) => {
      if (!e.target.dataset.f) return;
      read();
      this.commit(false);
    });
    let typing = 0;
    sheet.querySelector('[data-f="contributor"]').addEventListener('input', () => {
      clearTimeout(typing);
      typing = setTimeout(() => {
        read();
        this.commit(false);
      }, 200);
    });
    sheet.addEventListener('click', (e) => {
      const b = e.target.closest('[data-f-act]');
      if (!b) return;
      if (b.dataset.fAct === 'apply') {
        clearTimeout(typing);
        read();
        closeSheet(sheet);
        this.commit(false);
      } else if (b.dataset.fAct === 'clear') {
        Object.assign(s, { ...DEFAULTS, collection: s.base === '/works' ? '' : s.collection });
        this.input.value = '';
        this.root.querySelector('.lw-top').classList.remove('has-q');
        for (const el of sheet.querySelectorAll('[data-f]')) el.value = s[el.dataset.f];
        this.commit(false);
      } else if (b.dataset.fAct === 'inspect-all') {
        s.availability = 'all';
        s.offset = '0';
        sheet.querySelector('[data-f="availability"]').value = 'all';
        closeSheet(sheet);
        this.commit(false);
      }
    });
  }
  escape() {
    const layer = this.slot('layer');
    const top = layer && layer.querySelector('.lw-sheet:last-of-type');
    if (!top) return false;
    closeSheet(top);
    return true;
  }
}

// ─── Sheets ─────────────────────────────────────────────────────────────────
function openSheet(layer, { title, text, body, opener, lib, kind }) {
  for (const old of layer.querySelectorAll('.lw-sheet')) closeSheet(old, false);
  const id = 'lw-sheet-' + kind;
  layer.insertAdjacentHTML(
    'beforeend',
    `<div class="lw-scrim cm-scrim" data-lw-scrim></div><section class="lw-sheet cm-panel" role="dialog" aria-modal="true" aria-labelledby="${id}-t" data-kind="${esc(kind)}">` +
      `<header><div><h2 id="${id}-t">${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}</div><button type="button" class="cm-btn cm-btn-icon" data-lw-close aria-label="Close">${ic(lib, 'x', 18)}</button></header>` +
      `<div class="lw-sheet-body">${body}</div></section>`
  );
  const sheet = layer.lastElementChild;
  const scrim = sheet.previousElementSibling;
  sheet._opener = opener;
  sheet._scrim = scrim;
  scrim.addEventListener('click', () => closeSheet(sheet));
  sheet.querySelector('[data-lw-close]').addEventListener('click', () => closeSheet(sheet));
  sheet.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [
      ...sheet.querySelectorAll('button:not([disabled]),select,input,summary,[tabindex="0"]'),
    ];
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) {
      e.preventDefault();
      f[f.length - 1].focus();
    } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
      e.preventDefault();
      f[0].focus();
    }
  });
  (sheet.querySelector('select,input,[data-lw-close]') || sheet).focus();
  return sheet;
}
function closeSheet(sheet, refocus = true) {
  sheet._scrim?.remove();
  sheet.remove();
  if (refocus && sheet._opener?.isConnected) sheet._opener.focus();
}

// The Site's evidence Value: a recursive, collapsible view of recorded data.
function valueHTML(v, depth = 0) {
  if (v === undefined) return '<span class="lw-unknown">Not loaded yet</span>';
  if (v === null) return '<span class="lw-unknown">Undeclared / unread</span>';
  if (typeof v === 'boolean')
    return `<span class="${v ? 'lw-yes' : 'lw-unknown'}">${v ? 'Yes' : 'No'}</span>`;
  if (typeof v !== 'object') return `<span>${esc(String(v))}</span>`;
  const entries = Array.isArray(v) ? v.map((x, i) => ['Item ' + (i + 1), x]) : Object.entries(v);
  if (!entries.length)
    return `<span class="lw-unknown">${Array.isArray(v) ? 'None recorded' : 'Empty'}</span>`;
  const shown = entries.slice(0, 100);
  const more =
    entries.length > shown.length
      ? `<span class="lw-unknown">${entries.length - shown.length} more values not shown</span>`
      : '';
  const scalar = (x) => x === null || typeof x !== 'object';
  return (
    `<div class="lw-kv">` +
    shown
      .map(([k, x]) =>
        scalar(x)
          ? `<span>${esc(words(k))}</span>${valueHTML(x, depth + 1)}`
          : `<details style="grid-column:1/-1"${depth < 1 ? ' open' : ''}><summary>${esc(words(k))}</summary>${valueHTML(x, depth + 1)}</details>`
      )
      .join('') +
    `</div>${more}`
  );
}

function metadataBody(m, state) {
  const who = (m.contributors || [])
    .map((c) => (c.role ? `${c.name} (${c.role})` : c.name))
    .join('; ');
  const dl = [
    ['Contributors', who || m.contributor_search || 'Source contributor unknown'],
    ['Language', languageName(m.language)],
    ['Completeness', words(m.completeness)],
    ['Reading unit', m.reading_unit_id],
    ['Work', m.work_id],
    ['Edition', m.edition_id],
    ['Revision', m.reading_revision],
  ].filter(([, v]) => v);
  const status =
    state === 'loading'
      ? `<p class="cm-status" role="status">Loading the recorded metadata…</p>`
      : state === 'failed'
        ? `<p class="cm-status" data-tone="warning" role="status">The full record could not be loaded; showing what the list carries.</p>`
        : '';
  return (
    `<div><span class="lw-badge" data-a="${esc(m.availability)}">${esc(words(m.availability))}</span></div>` +
    status +
    `<dl class="lw-dl">${dl.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` +
    `<div class="lw-value">${valueHTML({
      source_path: m.source_path,
      availability_reason: m.availability_reason,
      source_basis: m.source_basis,
      work_reviewed_equivalence: m.work_reviewed_equivalence,
    })}</div>` +
    (m.availability === 'readable'
      ? `<button type="button" class="cm-btn cm-btn-primary" data-lw-read>Read</button>`
      : `<p class="lw-note">Admission requires resolving the recorded evidence before a source body can be read or exported.</p>`)
  );
}

// The metadata sheet for one unit (any availability): what the row carries
// at once, then GET /metadata/:id. Other chunks (the reader, for a held deep
// link) can open it too: openMetadata(lib, id, { layer }).
async function openMetadata(lib, id, { opener = null, row = null, layer = null } = {}) {
  injectStyle();
  if (!layer) {
    layer = document.querySelector('#surface-library [data-lw-layer]');
    if (!layer) {
      layer = document.createElement('div');
      layer.dataset.lwLayer = '';
      (document.getElementById('surface-library') || document.body).append(layer);
    }
  }
  const base = row || { reading_unit_id: id, availability: 'unknown' };
  const sheet = openSheet(layer, {
    title: base.title || 'Source record',
    text: 'Recorded availability and source evidence',
    body: metadataBody(base, 'loading'),
    opener,
    lib,
    kind: 'metadata',
  });
  const body = sheet.querySelector('.lw-sheet-body');
  const wire = (m) =>
    body.querySelector('[data-lw-read]')?.addEventListener('click', () => {
      closeSheet(sheet, false);
      const key = m.path_key || '';
      lib.go(`/read/${encodeURIComponent(id)}${key ? '?revision=' + encodeURIComponent(key) : ''}`);
    });
  wire(base);
  let m;
  try {
    m = await lib.get('/metadata/' + encodeURIComponent(id));
  } catch {
    if (!sheet.isConnected) return sheet;
    body.innerHTML = metadataBody(base, 'failed');
    wire(base);
    return sheet;
  }
  if (!sheet.isConnected) return sheet;
  const merged = { ...base, ...m, path_key: base.path_key };
  sheet.querySelector('h2').textContent = merged.title || 'Source record';
  body.innerHTML = metadataBody(merged, 'ready');
  wire(merged);
  return sheet;
}

return {
  // main: the Library's content element; sub: '/works?…' (or
  // '/collections/<id>?…' if core hands a collection over); lib: the shared
  // service (docs/library-ui-contract.md).
  show(main, sub, lib) {
    LIB = lib;
    let view = VIEWS.get(main);
    if (!view || !view.root.isConnected || view.lib !== lib) {
      view?.dispose();
      view = new WorksView(main, lib);
      VIEWS.set(main, view);
    } else if (view.sub === format(parse(sub))) {
      // Our own lib.go echoing back, or a return to the route already shown
      // while a later update() still waits on the catalog: that update is
      // superseded either way (Jony's review).
      view.generation = (view.generation || 0) + 1;
      return view;
    }
    ACTIVE = view;
    view.update(sub || '/works');
    return view;
  },
  // Closes the topmost Works layer (metadata or filter sheet); true if it did.
  escape: () => Boolean(ACTIVE && ACTIVE.root.isConnected && ACTIVE.escape()),
  openMetadata,
  parse,
  format,
};

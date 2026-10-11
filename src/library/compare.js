// ─── Library chunk: compare ────────────────────────────────────────────────
// Wrapped by the build as CMLibraryDefine('compare', function () { … }).
// The "Text comparison" sheet of the reader: the comparison picker (other
// readings of the same recorded work first, then free search) and the aligned
// side-by-side comparison with intra-line differences. alignLines/intraLine are
// an exact port of sites/library/lib/compare-text.ts.
//
// mount(container, { left, rightId, lib, passage, onClose }) → { close, choose }
//   left     the open reading: its head (reading_unit_id, title, …) or its id;
//            every page is (re)fetched here, so a windowed reader is fine.
//   rightId  optional second reading; when set the comparison renders at once.
//   passage  optional selected earlier rows (0-based global row indices, or
//            line ids when `left.lineIds` maps row → id) to restrict to.
//   onClose  called after the sheet closes (Escape, scrim, close button).
// The sheet keeps `compare=<id>` in the hash with replaceState and removes it
// on close, as the old Site did with ?compare.
/* global esc, icon, libraryChunk */
'use strict';

const PAGE_ROWS = 250;

// ── compare-text.ts ──────────────────────────────────────────────────────────
// Unique exact anchors preserve order; ambiguous intervals retain every row.
// This is deterministic source/text alignment, not a claim of work equivalence.
function alignLines(a, b) {
  const ca = new Map(),
    cb = new Map();
  a.forEach((s, i) => ca.set(s, [...(ca.get(s) ?? []), i]));
  b.forEach((s, i) => cb.set(s, [...(cb.get(s) ?? []), i]));
  const pairs = [];
  for (let i = 0; i < a.length; i++) {
    const aa = ca.get(a[i]),
      bb = cb.get(a[i]);
    if (a[i].trim() && aa.length === 1 && bb?.length === 1) pairs.push([i, bb[0]]);
  }
  const tails = [],
    prev = new Array(pairs.length).fill(-1);
  for (let i = 0; i < pairs.length; i++) {
    let lo = 0,
      hi = tails.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (pairs[tails[m]][1] < pairs[i][1]) lo = m + 1;
      else hi = m;
    }
    if (lo) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const anchors = [];
  let at = tails.length ? tails[tails.length - 1] : -1;
  while (at >= 0) {
    anchors.push(pairs[at]);
    at = prev[at];
  }
  anchors.reverse();
  anchors.push([a.length, b.length]);
  const output = [];
  let ai = 0,
    bi = 0;
  for (const [ax, bx] of anchors) {
    while (ai < ax || bi < bx) {
      const va = ai < ax ? a[ai] : null,
        vb = bi < bx ? b[bi] : null;
      output.push({
        earlier: va === null ? null : ai + 1,
        other: vb === null ? null : bi + 1,
        status: va === null ? 'added' : vb === null ? 'removed' : va === vb ? 'same' : 'changed',
        a: va ?? '',
        b: vb ?? '',
      });
      if (va !== null) ai++;
      if (vb !== null) bi++;
    }
    if (ax < a.length && bx < b.length) {
      output.push({ earlier: ax + 1, other: bx + 1, status: 'same', a: a[ax], b: b[bx] });
      ai = ax + 1;
      bi = bx + 1;
    }
  }
  return output;
}

function intraLine(a, b) {
  const aa = Array.from(a),
    bb = Array.from(b);
  let p = 0,
    s = 0;
  while (p < Math.min(aa.length, bb.length) && aa[p] === bb[p]) p++;
  while (
    s < Math.min(aa.length - p, bb.length - p) &&
    aa[aa.length - s - 1] === bb[bb.length - s - 1]
  )
    s++;
  return {
    a: [
      aa.slice(0, p).join(''),
      aa.slice(p, aa.length - s).join(''),
      s ? aa.slice(-s).join('') : '',
    ],
    b: [
      bb.slice(0, p).join(''),
      bb.slice(p, bb.length - s).join(''),
      s ? bb.slice(-s).join('') : '',
    ],
    precision: 'exact_codepoint_difference_region',
  };
}

// ── Static reading loader ────────────────────────────────────────────────────
// Head through lib.reading(id); page files `<k>-<sha12>.json.gz` beside it,
// each checked against the head's sha256 (of the inflated bytes) and its
// embedded identity. Any mismatch fails closed: no text is shown.
const wholeCache = new Map();

async function inflateBytes(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] !== 0x1f || u8[1] !== 0x8b) return u8; // already decoded by the host
  if (typeof DecompressionStream === 'function') {
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const inflate = await libraryChunk('inflate');
  return inflate.gunzip(u8);
}

async function sha256Hex(u8) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', u8));
  return Array.from(d, (x) => x.toString(16).padStart(2, '0')).join('');
}

async function headDir(lib, id) {
  let p = await lib.unitPath(id);
  if (p && typeof p === 'object') p = p.path || p.dir || p.href || '';
  p = String(p || '').replace(/head\.json(\.gz)?$/, '');
  if (p && !p.endsWith('/')) p += '/';
  if (p.startsWith(lib.base)) p = p.slice(lib.base.length);
  return p;
}

async function loadWhole(lib, idOrHead) {
  const id = typeof idOrHead === 'string' ? idOrHead : idOrHead.reading_unit_id;
  if (wholeCache.has(id)) return wholeCache.get(id);
  const job = (async () => {
    const head = typeof idOrHead === 'object' && idOrHead.pages ? idOrHead : await lib.reading(id);
    if (!head || head.reading_unit_id !== id || head.page_index !== 0)
      throw new Error('This reading could not be verified; no text is shown.');
    const lines = head.lines.slice(0, PAGE_ROWS);
    if (head.pages && head.pages.length) {
      const dir = await headDir(lib, id);
      const pages = await Promise.all(
        head.pages.map(async (digest, k) => {
          const res = await fetch(lib.base + dir + `${k + 1}-${digest.slice(0, 12)}.json.gz`);
          if (!res.ok) throw new Error(`A page of “${head.title}” is unavailable (${res.status}).`);
          const inner = await inflateBytes(await res.arrayBuffer());
          if ((await sha256Hex(inner)) !== digest)
            throw new Error('A page failed its integrity check; no text is shown.');
          const page = JSON.parse(new TextDecoder().decode(inner));
          if (
            page.reading_unit_id !== id ||
            page.reading_revision !== head.reading_revision ||
            page.page_index !== k + 1 ||
            page.page_count !== head.page_count
          )
            throw new Error('A page did not match its reading; no text is shown.');
          return page.lines;
        })
      );
      for (const p of pages) lines.push(...p);
    }
    // Line: [kind, text, indent, physical_line, analysis_line, source_cp_range, source_text?, source_ranges]
    return {
      ...head,
      rows: lines.map((l, row) => ({
        row,
        text: l[1],
        analysis_line: l[4],
        source_text: l[6] ?? l[1],
      })),
    };
  })();
  wholeCache.set(id, job);
  job.catch(() => wholeCache.delete(id));
  return job;
}

// ── Styles ───────────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.querySelector('style[data-lib="compare"]')) return;
  document.head.insertAdjacentHTML(
    'beforeend',
    `<style data-lib="compare">
#surface-library .lib-cmp-scrim{position:fixed;inset:0;z-index:60}
#surface-library .lib-cmp-sheet{position:fixed;left:0;right:0;bottom:0;z-index:61;max-height:88vh;overflow:auto;
  border-radius:var(--cm-radius-lg) var(--cm-radius-lg) 0 0;padding:20px 24px 28px;color:var(--cm-text);font-family:var(--cm-font)}
#surface-library .lib-cmp-top{display:flex;align-items:flex-start;gap:12px}
#surface-library .lib-cmp-top h2{margin:0;font:600 20px var(--cm-font)}
#surface-library .lib-cmp-top p{margin:4px 0 0;color:var(--cm-text-muted);font-size:var(--cm-text-sm)}
#surface-library .lib-cmp-top .cm-btn{margin-left:auto}
#surface-library .lib-cmp-picker{display:grid;gap:8px;margin:18px 0}
#surface-library .lib-cmp-picker h3{margin:4px 0;font:600 var(--cm-text-sm) var(--cm-font);color:var(--cm-text-secondary)}
#surface-library .lib-cmp-picker label{display:grid;gap:6px;margin-top:6px;font-size:var(--cm-text-sm);color:var(--cm-text-secondary)}
#surface-library .lib-cmp-pick{width:100%;justify-content:flex-start;text-align:left;white-space:normal}
#surface-library .lib-cmp-pick[aria-pressed="true"]{border-color:var(--cm-accent);background:var(--cm-accent-soft);color:var(--cm-accent-text)}
#surface-library .lib-cmp-pick small{color:var(--cm-text-muted);margin-left:6px}
#surface-library .lib-cmp-error{color:var(--cm-danger-text);font-size:var(--cm-text-sm)}
#surface-library .lib-cmp-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;font-size:13px;color:var(--cm-text-secondary)}
#surface-library .lib-cmp-bar label{display:inline-flex;align-items:center;gap:6px;cursor:pointer}
#surface-library .lib-cmp-badge{padding:2px 10px;border-radius:999px;background:var(--cm-surface-sunken);color:var(--cm-text);font-weight:500}
#surface-library .lib-cmp-badge.reviewed{background:var(--cm-success-soft);color:var(--cm-success-text)}
#surface-library .lib-cmp-note{font-size:12px;color:var(--cm-text-muted);margin:8px 0 12px}
#surface-library .lib-cmp-modes{max-width:420px}
#surface-library .lib-cmp-heads{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0 8px;font:20px Georgia,serif}
#surface-library .lib-cmp-heads h3{margin:0;font:inherit}
#surface-library .lib-cmp-rows>div{display:grid;grid-template-columns:1fr 1fr;gap:18px;border-bottom:1px solid var(--cm-border-subtle)}
#surface-library .lib-cmp-rows>div>div{display:flex;gap:12px;padding:9px 6px;white-space:pre-wrap;font:18px/1.5 Georgia,serif;color:var(--cm-text)}
#surface-library .lib-cmp-rows small{color:var(--cm-text-faint);font:12px var(--cm-font);min-width:22px;padding-top:4px}
#surface-library .lib-cmp-rows mark{background:var(--cm-warning-soft);color:var(--cm-text);box-shadow:inset 0 -2px 0 var(--cm-warning)}
#surface-library .lib-cmp-rows mark:empty{box-shadow:none}
#surface-library .lib-cmp-rows .difference-added>div:last-child{background:var(--cm-success-soft)}
#surface-library .lib-cmp-rows .difference-removed>div:first-child{background:var(--cm-danger-soft)}
#surface-library .lib-cmp-more{margin-top:14px}
@media (max-width:720px){
  #surface-library .lib-cmp-sheet{padding:16px 14px 24px}
  #surface-library .lib-cmp-rows>div{grid-template-columns:1fr;gap:0}
  #surface-library .lib-cmp-rows.view-earlier>div>div:last-child{display:none}
  #surface-library .lib-cmp-rows.view-other>div>div:first-child{display:none}
  #surface-library .lib-cmp-heads{grid-template-columns:1fr;gap:4px;font-size:16px}
  #surface-library .lib-cmp-heads.view-earlier h3:last-child,#surface-library .lib-cmp-heads.view-other h3:first-child{display:none}
}
</style>`
  );
}

// ── Hash: keep ?compare=<id> in #library/read/<id>?… ──────────────────────────
function setCompareParam(value) {
  const h = location.hash;
  if (!h.startsWith('#library/read/')) return;
  const q = h.indexOf('?');
  const path = q < 0 ? h : h.slice(0, q);
  const params = new URLSearchParams(q < 0 ? '' : h.slice(q + 1));
  if (value) params.set('compare', value);
  else params.delete('compare');
  const s = params.toString();
  history.replaceState(history.state, '', path + (s ? '?' + s : ''));
}

const pickButton = (r, chosen) =>
  `<button type="button" class="cm-btn cm-btn-outline lib-cmp-pick" data-pick="${esc(r.reading_unit_id)}" aria-pressed="${r.reading_unit_id === chosen}">${esc(r.title || r.reading_unit_id)}<small>${esc(r.source_path || '')}</small></button>`;

// ── mount ────────────────────────────────────────────────────────────────────
function mount(container, opts) {
  injectStyles();
  const { lib } = opts;
  const leftId = typeof opts.left === 'string' ? opts.left : opts.left.reading_unit_id;
  const opener = document.activeElement;
  const host = container.closest('#surface-library')
    ? container
    : document.getElementById('surface-library') || container;
  const scrim = document.createElement('div');
  scrim.className = 'cm-scrim lib-cmp-scrim';
  const sheet = document.createElement('section');
  sheet.className = 'cm-panel lib-cmp-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'lib-cmp-title');
  sheet.dataset.libraryChunk = 'compare';
  sheet.innerHTML = `<div class="lib-cmp-top"><div><h2 id="lib-cmp-title">Text comparison</h2>
<p>Compare complete units or a selected passage. Edition equivalence requires a reviewed work identity.</p></div>
<button type="button" class="cm-btn cm-btn-icon" data-close aria-label="Close comparison">${icon('close', 20)}</button></div>
<div class="lib-cmp-picker"></div><div class="lib-cmp-body"></div>`;
  host.append(scrim, sheet);
  const pickerEl = sheet.querySelector('.lib-cmp-picker');
  const bodyEl = sheet.querySelector('.lib-cmp-body');
  let alive = true,
    chosen = opts.rightId || '',
    related = [],
    results = [],
    query = '',
    error = '',
    timer = 0,
    token = 0;

  // Picker: other readings of the same recorded work, from the static head's
  // work_readings (current id excluded, title-ordered), then free search.
  const renderPicker = () => {
    const input = pickerEl.querySelector('input');
    const focused = input && document.activeElement === input;
    pickerEl.innerHTML =
      (related.length
        ? `<h3>Other readings of this recorded work</h3>${related.map((r) => pickButton(r, chosen)).join('')}`
        : '') +
      `<label>Find another readable work<input class="cm-input" type="search" placeholder="Title, contributor or exact phrase" value="${esc(query)}"></label>` +
      (error ? `<p class="lib-cmp-error" role="alert">${esc(error)}</p>` : '') +
      (query ? results.map((r) => pickButton(r, chosen)).join('') : '');
    if (focused) {
      const next = pickerEl.querySelector('input');
      next.focus();
      next.setSelectionRange(query.length, query.length);
    }
  };
  pickerEl.addEventListener('input', (e) => {
    if (e.target.tagName !== 'INPUT') return;
    query = e.target.value;
    clearTimeout(timer);
    if (!query) return renderPicker();
    const mine = ++token;
    timer = setTimeout(() => {
      lib
        .get(`/search?availability=readable&limit=20&q=${encodeURIComponent(query)}`)
        .then((r) => {
          if (!alive || mine !== token) return;
          results = (r.items || []).filter((x) => x.reading_unit_id !== leftId);
          error = '';
          renderPicker();
        })
        .catch((err) => {
          if (!alive || mine !== token) return;
          error = err.message;
          renderPicker();
        });
    }, 250);
  });
  pickerEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (b) choose(b.dataset.pick);
  });

  Promise.resolve(
    typeof opts.left === 'object' && opts.left.lines ? opts.left : lib.reading(leftId)
  )
    .then((head) => {
      if (!alive) return;
      related = (head.work_readings || [])
        .map(([reading_unit_id, title, source_path]) => ({ reading_unit_id, title, source_path }))
        .filter((r) => r.reading_unit_id !== leftId);
      renderPicker();
    })
    .catch((err) => {
      if (!alive) return;
      error = err.message;
      renderPicker();
    });
  renderPicker();

  // Comparison.
  let view = null; // { data:[L,R], source, mode, limit }
  const passageRows = () => {
    const p = opts.passage || [];
    if (!p.length) return null;
    const ids = opts.left && opts.left.lineIds;
    const set = new Set(p.map((x) => (typeof x === 'number' ? x : ids ? ids.indexOf(x) : -1)));
    return set;
  };
  const aligned = () => {
    const { data, source } = view;
    const keep = (rows) => rows.filter((l) => source || l.analysis_line !== null);
    const la = keep(data[0].rows),
      lb = keep(data[1].rows);
    const result = alignLines(
      la.map((l) => (source ? l.source_text : l.text)),
      lb.map((l) => (source ? l.source_text : l.text))
    );
    const rows = passageRows();
    if (!rows || !rows.size) return result;
    const chosenIdx = new Set(la.map((l, i) => (rows.has(l.row) ? i + 1 : 0)).filter(Boolean));
    if (!chosenIdx.size) return result;
    const bounds = [Math.min(...chosenIdx), Math.max(...chosenIdx)];
    let previous = 0;
    return result.filter((row) => {
      if (row.earlier) previous = row.earlier;
      return row.earlier
        ? chosenIdx.has(row.earlier)
        : previous >= bounds[0] && previous < bounds[1];
    });
  };
  const side = (num, diff, status, dir, lang) =>
    `<div dir="${esc(dir || 'auto')}"><small>${num}</small><span lang="${esc(lang || '')}">${esc(diff[0])}<mark>${
      status === 'same' ? '' : esc(diff[1])
    }</mark>${status === 'same' ? esc(diff[1]) : ''}${esc(diff[2])}</span></div>`;
  const renderComparison = () => {
    const { data, source, mode, limit } = view;
    const rows = aligned();
    const changed = rows.filter((l) => l.status !== 'same').length;
    const reviewed =
      data[0].work_id === data[1].work_id &&
      data[0].work_reviewed_equivalence === true &&
      data[1].work_reviewed_equivalence === true;
    const passageCount = (opts.passage || []).length;
    const m = mode.toLowerCase();
    bodyEl.innerHTML = `<section class="lib-cmp-view">
<div class="lib-cmp-bar">
  <label><input type="checkbox" data-source ${source ? 'checked' : ''}> Source transcription</label>
  <span class="lib-cmp-badge${reviewed ? ' reviewed' : ''}">${reviewed ? 'Reviewed work comparison' : 'Text comparison'}</span>
  ${passageCount ? `<span>Selected earlier passage · ${passageCount} lines</span>` : ''}
  <span data-count>${changed} differing aligned rows / ${rows.length} total</span>
</div>
<p class="lib-cmp-note">${source ? 'Exact source rows' : 'Normalized analysis lines'} · deterministic ordered exact anchors, then positional alignment in ambiguous intervals. Work equivalence is not inferred.</p>
<div class="cm-segmented lib-cmp-modes" role="group" aria-label="Comparison view">${[
      'Earlier',
      'Other',
      'Differences',
    ]
      .map(
        (x) => `<button type="button" data-mode="${x}" aria-pressed="${x === mode}">${x}</button>`
      )
      .join('')}</div>
<div class="lib-cmp-heads view-${m}"><h3 dir="${esc(data[0].direction || 'auto')}">${esc(data[0].title)}</h3><h3 dir="${esc(data[1].direction || 'auto')}">${esc(data[1].title)}</h3></div>
<div class="lib-cmp-rows view-${m}">${rows
      .slice(0, limit)
      .map((l) => {
        const diff = intraLine(l.a, l.b);
        return `<div class="difference-${l.status}">${side(l.earlier ?? '+', diff.a, l.status, data[0].direction, data[0].language)}${side(
          l.other ?? '−',
          diff.b,
          l.status,
          data[1].direction,
          data[1].language
        )}</div>`;
      })
      .join('')}</div>
${limit < rows.length ? `<button type="button" class="cm-btn cm-btn-outline lib-cmp-more" data-more>Show next aligned rows · ${limit} / ${rows.length}</button>` : ''}
</section>`;
  };
  bodyEl.addEventListener('click', (e) => {
    if (!view) return;
    const mode = e.target.closest('[data-mode]');
    if (mode) {
      view.mode = mode.dataset.mode;
      renderComparison();
    } else if (e.target.closest('[data-more]')) {
      view.limit += 250;
      renderComparison();
    }
  });
  bodyEl.addEventListener('change', (e) => {
    if (view && e.target.matches('[data-source]')) {
      view.source = e.target.checked;
      view.limit = 250;
      renderComparison();
    }
  });

  function choose(id) {
    if (!alive || !id) return;
    chosen = id;
    setCompareParam(id);
    renderPicker();
    const mine = ++token;
    view = null;
    bodyEl.innerHTML =
      '<p class="lib-cmp-note" role="status">Loading both complete reading units…</p>';
    Promise.all([loadWhole(lib, leftId), loadWhole(lib, id)])
      .then((data) => {
        if (!alive || mine !== token) return;
        view = { data, source: false, mode: 'Differences', limit: 250 };
        renderComparison();
      })
      .catch((err) => {
        if (!alive || mine !== token) return;
        bodyEl.innerHTML = `<p class="lib-cmp-error" role="alert">${esc(err.message)}</p>`;
      });
  }

  function close() {
    if (!alive) return;
    alive = false;
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey, true);
    scrim.remove();
    sheet.remove();
    setCompareParam(null);
    if (opener && opener.isConnected && opener.focus) opener.focus();
    if (opts.onClose) opts.onClose();
  }
  const onKey = (e) => {
    if (e.key !== 'Escape' || !alive) return;
    e.preventDefault();
    e.stopPropagation();
    close();
  };
  document.addEventListener('keydown', onKey, true);
  scrim.addEventListener('click', close);
  sheet.querySelector('[data-close]').addEventListener('click', close);
  if (chosen) choose(chosen);
  setTimeout(() => alive && (sheet.querySelector('.lib-cmp-pick, input') || sheet).focus(), 0);
  return {
    close,
    choose,
    escape: () => (alive ? (close(), true) : false),
    get open() {
      return alive;
    },
  };
}

return { mount, alignLines, intraLine, loadWhole };

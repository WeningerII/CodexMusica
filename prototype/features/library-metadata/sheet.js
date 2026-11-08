// Library matrix 14 / checklist 234. Production semantics: src/library/works.js
// metadataBody/valueHTML at 10b42689f04db0f16a98425b3e22c9a5487b254c.
// Accepted contract: frozen ctx with storage, announce, signal and immutable
// record (metadata object, not an HTTP Response or search envelope).
// Don confirmed this at #668 comment 6641909843. Host owns transport, layering,
// route/history and inertness. This is a nonmodal dialog.
// Closable hosts also supply ctx.close(); the host owns teardown and focus return.
// No persistence is needed; ctx.storage is deliberately unused.
const STATES = new Set(['held', 'metadata_only', 'research_only', 'rejected', 'readable']);
// Top-level presentation selects named fields; nested evidence uses this denylist.
const OMIT = new Set([
  'body',
  'reading',
  'text',
  'source_text',
  'normalized_text',
  'snippet',
  'search_hit',
  'labels',
  'source_labels',
  'lines',
  'pages',
]);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const words = (s) => String(s).replace(/_/g, ' ');
const scalar = (v) => ['string', 'number', 'boolean'].includes(typeof v);
// Same recorded-language labels as production core.js; unknown codes survive.
const LANGUAGES = {
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

function value(v, depth = 0, seen = new Set()) {
  if (v === undefined) return '<span>Not loaded yet</span>';
  if (v === null) return '<span>Undeclared / unread</span>';
  if (typeof v === 'boolean') return `<span>${v ? 'Yes' : 'No'}</span>`;
  if (scalar(v)) return `<span>${esc(v)}</span>`;
  if (typeof v !== 'object' || seen.has(v) || depth > 12)
    return '<span>Evidence could not be displayed</span>';
  const next = new Set(seen).add(v);
  const entries = (
    Array.isArray(v) ? v.map((x, i) => ['Item ' + (i + 1), x]) : Object.entries(v)
  ).filter(([k]) => !OMIT.has(k));
  if (!entries.length) return `<span>${Array.isArray(v) ? 'None recorded' : 'Empty'}</span>`;
  return (
    '<div class="lm-values">' +
    entries
      .slice(0, 100)
      .map(([k, x]) =>
        x !== null && typeof x === 'object'
          ? `<details${depth < 1 ? ' open' : ''}><summary>${esc(words(k))}</summary>${value(x, depth + 1, next)}</details>`
          : `<div><strong>${esc(words(k))}</strong>${value(x, depth + 1, next)}</div>`
      )
      .join('') +
    (entries.length > 100 ? `<p>${entries.length - 100} more values not shown</p>` : '') +
    '</div>'
  );
}

function valid(m, id) {
  if (
    !m ||
    typeof m !== 'object' ||
    Array.isArray(m) ||
    m.reading_unit_id !== id ||
    !STATES.has(m.availability)
  )
    return false;
  for (const key of [
    'title',
    'language',
    'completeness',
    'work_id',
    'edition_id',
    'reading_revision',
    'source_path',
    'contributor_search',
  ]) {
    if (m[key] != null && typeof m[key] !== 'string') return false;
  }
  if (m.work_reviewed_equivalence != null && typeof m.work_reviewed_equivalence !== 'boolean')
    return false;
  if (
    m.contributors != null &&
    (!Array.isArray(m.contributors) ||
      m.contributors.some(
        (c) => !c || typeof c.name !== 'string' || (c.role != null && typeof c.role !== 'string')
      ))
  )
    return false;
  for (const key of ['availability_reason', 'source_basis']) {
    if (m[key] != null && (typeof m[key] !== 'object' || Array.isArray(m[key]))) return false;
  }
  return true;
}

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const style = doc.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./sheet.css', import.meta.url).href;
  style.dataset.libraryMetadataStyle = '';
  host.append(style);
  const root = doc.createElement('section');
  root.className = 'lm-sheet';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Recorded availability and source evidence');
  root.tabIndex = -1;
  const controller = new AbortController();
  const id = typeof ctx.record?.reading_unit_id === 'string' ? ctx.record.reading_unit_id : '';
  let alive = true;
  const record = id && valid(ctx.record, id) ? ctx.record : null;
  const say = (s) => {
    if (alive && typeof ctx.announce === 'function') ctx.announce(s);
  };
  function render(message) {
    if (!alive) return;
    const m = record || {};
    const who = Array.isArray(m.contributors)
      ? m.contributors
          .filter((c) => c && typeof c.name === 'string')
          .map((c) => c.name + (typeof c.role === 'string' && c.role ? ` (${c.role})` : ''))
          .join('; ')
      : '';
    const rows = [
      [
        'Contributors',
        who ||
          (typeof m.contributor_search === 'string' && m.contributor_search) ||
          'Source contributor unknown',
      ],
      ['Language', LANGUAGES[m.language] || m.language],
      ['Completeness', m.completeness && words(m.completeness)],
      ['Reading unit', id],
      ['Work', m.work_id],
      ['Edition', m.edition_id],
      ['Revision', m.reading_revision],
    ].filter(([, v]) => scalar(v) && v !== '');
    root.innerHTML =
      `<header><h2 tabindex="-1">${esc((typeof m.title === 'string' && m.title) || 'Source record')}</h2><button type="button" data-lm-close aria-label="Close source record">Close</button></header>` +
      `<p class="lm-badge" data-availability="${esc(m.availability || 'unknown')}">${esc(words(m.availability || 'unknown'))}</p>` +
      (message ? `<p role="status">${esc(message)}</p>` : '') +
      (record && record.availability !== 'readable'
        ? '<p>This unit is not readable in this view. Admission requires resolving the recorded evidence before a source body can be read or exported.</p>'
        : '') +
      `<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` +
      value({
        source_path: m.source_path,
        availability_reason: m.availability_reason,
        source_basis: m.source_basis,
        work_reviewed_equivalence: m.work_reviewed_equivalence,
      });
  }
  function unmount() {
    if (!alive) return;
    alive = false;
    controller.abort();
    ctx.signal?.removeEventListener('abort', unmount);
    root.remove();
    style.remove();
  }
  function close() {
    ctx.close();
  }
  root.addEventListener(
    'click',
    (e) => {
      if (e.target.closest('[data-lm-close]')) close('button');
    },
    { signal: controller.signal }
  );
  root.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        e.stopPropagation();
        close('escape');
      }
    },
    { signal: controller.signal }
  );
  host.append(root);
  ctx.signal?.addEventListener('abort', unmount, { once: true });
  if (ctx.signal?.aborted) unmount();
  else if (!ctx.record) {
    render('No metadata record was supplied.');
    say('No metadata record was supplied.');
  } else if (!record) {
    render('The recorded metadata could not be displayed: its fields are invalid.');
    say('The recorded metadata could not be displayed.');
  } else {
    render('');
  }
  return {
    unmount,
    focus() {
      if (alive) root.querySelector('h2')?.focus();
    },
  };
}

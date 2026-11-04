// Checklist 237 / Library matrix17: standalone current-native reference.
// Pinned production and P2 source: src/library/analysis.js at 4798213646834c1c5c46ef74d0d9436f37cebd38.
// Input (provisional until host integration): ctx.registry is the complete
// library/data/methods.json object. ctx also supplies storage, announce, signal.
// Storage uses the common {ok,value?,reason?} boundary but this reference has
// no persisted state in production, so no reads/writes are necessary.
// Native filter searches name/aliases/required_capabilities, NOT definition;
// the historical matrix17 predicate differs. Keep row237 pending integration.
// No execution callbacks: every record is display-only.
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const label = (s) =>
  String(s)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const OMIT = new Set([
  'id',
  'source_ranges',
  'line_ids',
  'method_id',
  'reading_revision',
  'reading_unit_id',
  'snapshot_id',
  'identity_hash',
]);
// Values render lazily: a <details> body is built only when first opened
// (renderValue registers the deferred value; the toggle listener fills it).
function valueHTML(value, depth, defer) {
  if (value === undefined) return '<span class="la-unknown">Not loaded yet</span>';
  if (value === null) return '<span class="la-unknown">Undeclared / unread</span>';
  if (typeof value === 'boolean')
    return `<span class="${value ? 'la-pos' : 'la-muted'}">${value ? 'Yes' : 'No'}</span>`;
  if (typeof value === 'string' || typeof value === 'number')
    return `<span class="la-data">${esc(value)}</span>`;
  const lazy = (title, v, open = false) =>
    `<details class="la-lazy"${open ? ' open' : ''} data-defer="${defer(v, depth + 1)}"><summary>${esc(title)}</summary>${open ? valueHTML(v, depth + 1, defer) : ''}</details>`;
  const more = (shown, total, v) =>
    total > shown
      ? `<button type="button" class="la-link" data-more="${defer(v, depth, shown + 100)}">Show next values · ${shown} / ${total}</button>`
      : '';
  if (Array.isArray(value)) {
    const limit = value.__limit || 100;
    const loaded = Object.keys(value).length;
    if (loaded < value.length)
      return `<div><p class="la-note">${loaded} / ${value.length} entries loaded. Further evidence pages are required.</p>${Object.entries(
        value
      )
        .slice(0, limit)
        .map(([i, v]) => lazy('Item ' + (Number(i) + 1), v))
        .join('')}${more(Math.min(limit, loaded), loaded, value)}</div>`;
    if (!value.length) return '<span class="la-muted">Explicitly empty</span>';
    if (value.every((v) => typeof v !== 'object'))
      return `<span>${esc(value.slice(0, limit).map(String).join(' · '))}</span>${more(Math.min(limit, value.length), value.length, value)}`;
    return `<div class="la-items">${value
      .slice(0, limit)
      .map((v, i) =>
        lazy(
          v && typeof v === 'object'
            ? String(v.name ?? v.word ?? v.line_id ?? v.kind ?? v.method_id ?? `Item ${i + 1}`)
            : `Item ${i + 1}`,
          v,
          depth < 1 && value.length < 8
        )
      )
      .join('')}${more(Math.min(limit, value.length), value.length, value)}</div>`;
  }
  if ('numerator' in value && 'denominator' in value)
    return `<span>${esc(value.numerator)}/${esc(value.denominator)}</span>`;
  return `<dl class="la-grid">${Object.entries(value)
    .filter(([k]) => !OMIT.has(k))
    .map(
      ([k, v]) =>
        `<div><dt>${esc(label(k))}</dt><dd>${
          v && typeof v === 'object' && depth > 1
            ? lazy('Inspect ' + label(k).toLowerCase(), v)
            : valueHTML(v, depth + 1, defer)
        }</dd></div>`
    )
    .join('')}</dl>`;
}
// A renderer bound to one container: defer() stores values by index.
function valueRenderer(root, on) {
  const store = [];
  const defer = (v, depth, limit) => {
    store.push({ v, depth, limit });
    return store.length - 1;
  };
  on(
    root,
    'toggle',
    (e) => {
      const d = e.target;
      if (!(d instanceof HTMLDetailsElement) || !d.open || !d.dataset.defer || d.dataset.filled)
        return;
      const s = store[Number(d.dataset.defer)];
      d.dataset.filled = '1';
      if (s && d.children.length === 1)
        d.insertAdjacentHTML('beforeend', valueHTML(s.v, s.depth, defer));
    },
    true
  );
  on(root, 'click', (e) => {
    const b = e.target.closest('[data-more]');
    if (!b || !root.contains(b)) return;
    const s = store[Number(b.dataset.more)];
    const copy = Object.assign(s.v.slice(), { __limit: s.limit });
    // Holes survive slice(); keep the sparse view honest.
    b.parentElement.outerHTML = `<div>${valueHTML(copy, s.depth, defer)}</div>`;
  });
  return (v, depth = 0) => valueHTML(v, depth, defer);
}
function methodDetailHTML(m) {
  const scope =
    m.pair_local === undefined
      ? (m.scope ?? m.language ?? 'native')
      : m.pair_local
        ? 'Pair-local'
        : 'Whole figure';
  return `<details class="cm-accordion la-method" data-method="${esc(m.id)}">
    <summary><strong>${esc(m.name)}</strong> <small>${esc(m.namespace)} · ${esc(scope)}</small>${
      m.normative && m.normative !== 'ordinary'
        ? ` <span class="la-badge">${esc(m.normative)}</span>`
        : ''
    }</summary>
    <div class="la-method-body">
      <p>${esc(m.definition || 'Definition supplied by the installed engine.')}</p>
      ${m.aliases?.length ? `<p class="la-note">Also called ${esc(m.aliases.join(', '))}</p>` : ''}
      ${
        m.required_capabilities?.length
          ? `<h3>Requires</h3>${m.required_capabilities
              .map(
                (c) =>
                  `<p class="la-req"><span><b>${esc(label(c))}</b> <small>${esc(m.remedies?.[c] ?? '')}</small></span></p>`
              )
              .join('')}`
          : ''
      }
      ${m.figure ? `<details class="la-lazy" data-mfig><summary>Figure shape and alignment</summary></details>` : ''}
      ${m.provenance ? `<details class="la-lazy" data-mprov><summary>Tradition and provenance</summary></details>` : ''}
      
    </div>
  </details>`;
}

export function mount(host, ctx) {
  if (!host || !ctx?.registry || !Array.isArray(ctx.registry.methods))
    throw new TypeError('Method reference requires the methods registry.');
  // Snapshot without mutating or freezing objects owned by the caller.
  const registry = freeze(structuredClone(ctx.registry));
  const doc = host.ownerDocument;
  const root = doc.createElement('section');
  root.className = 'lm-reference';
  const stylesheet = doc.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./reference.css', import.meta.url).href;
  let stopped = false;
  let timer;
  const cleanup = [];
  const on = (target, type, listener, options) => {
    target.addEventListener(type, listener, options);
    cleanup.push(() => target.removeEventListener(type, listener, options));
  };
  const unmount = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    cleanup.splice(0).forEach((remove) => remove());
    stylesheet.remove();
    root.remove();
  };
  if (ctx.signal?.aborted) return { unmount, focus() {} };
  on(ctx.signal, 'abort', unmount, { once: true });
  root.innerHTML =
    '<details class="lm-disclosure"><summary>Method reference</summary><div class="lm-body"></div></details>';
  const disclosure = root.querySelector('.lm-disclosure');
  const body = root.querySelector('.lm-body');
  let loaded = false;
  on(disclosure, 'toggle', () => {
    if (!disclosure.open || loaded || stopped) return;
    loaded = true;
    body.innerHTML =
      '<input class="la-method-search" type="search" placeholder="Find a method or requirement" aria-label="Search method reference"><p class="lm-count"></p><div class="la-method-list"></div>';
    const search = body.querySelector('input');
    const list = body.querySelector('.la-method-list');
    const byId = new Map(registry.methods.map((m) => [m.id, m]));
    let render;
    // Each redraw gets a fresh deferred-value store, avoiding retention of
    // old result trees while the host keeps this component alive.
    let releaseRenderer = [];
    const rendererOn = (target, type, listener, options) => {
      target.addEventListener(type, listener, options);
      const remove = () => target.removeEventListener(type, listener, options);
      releaseRenderer.push(remove);
    };
    cleanup.push(() => releaseRenderer.forEach((remove) => remove()));
    const draw = (q, announce = false) => {
      if (stopped) return;
      releaseRenderer.forEach((remove) => remove());
      releaseRenderer = [];
      render = valueRenderer(list, rendererOn);
      const query = q.toLowerCase();
      const hits = registry.methods.filter((m) =>
        `${m.name} ${m.aliases?.join(' ')} ${m.required_capabilities?.join(' ')}`
          .toLowerCase()
          .includes(query)
      );
      list.innerHTML = hits.length
        ? hits
            .slice(0, 300)
            .map((m) => methodDetailHTML(m))
            .join('')
        : '<p><strong>No method matches</strong><br>Try a shorter word.</p>';
      const count = `${Math.min(hits.length, 300)} shown · ${hits.length} matching · ${registry.methods.length} methods`;
      body.querySelector('.lm-count').textContent = count;
      if (announce) ctx.announce?.(count);
    };
    on(search, 'input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => draw(search.value, true), 120);
    });
    on(
      list,
      'toggle',
      (e) => {
        const d = e.target;
        if (!d.open || d.dataset.filled) return;
        const m = byId.get(d.closest('[data-method]')?.dataset.method);
        if (!m) return;
        if ('mfig' in d.dataset) {
          d.dataset.filled = '1';
          d.insertAdjacentHTML('beforeend', render({ figure: m.figure, channels: m.channels }));
        }
        if ('mprov' in d.dataset) {
          d.dataset.filled = '1';
          d.insertAdjacentHTML('beforeend', render(m.provenance));
        }
      },
      true
    );
    draw('');
  });
  host.append(stylesheet, root);
  return {
    unmount,
    focus() {
      if (!stopped) disclosure.querySelector('summary').focus();
    },
  };
}

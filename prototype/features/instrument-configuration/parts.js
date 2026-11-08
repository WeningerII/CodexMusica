// Rows 199–200. Contracts: #668 comments 6646846068 and 6647373109.
// Search normalization mirrors production normalizeSearch; scenario checks parity.
function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u02bb\u02bc\u02be\u02bf]/g, '')
    .replace(/[\u002D\u2013\u2014]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
let nextHost = 0;
export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const groupPrefix = `ic-parts-${++nextHost}`;
  let initialized = false;
  const root = doc.createElement('section');
  root.className = 'ic-parts';
  root.setAttribute('aria-label', 'Instrument parts');
  let disposed = false;
  let shown;
  let instrument;
  let open = new Set();
  let more = new Set();
  let filters = new Map();
  const filterGroups = new Map();
  let pending = null;
  let failure = '';
  let lastErrorRevision;
  let lastErrorInstrument;
  let lastNoteRevision;
  let lastNoteInstrument;
  let unsubscribe = () => {};
  const listeners = [];
  const make = (tag, text, cls) => {
    const el = doc.createElement(tag);
    if (text != null) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  const key = (...values) => JSON.stringify(values);
  function dispose() {
    if (disposed) return;
    disposed = true;
    pending = null;
    unsubscribe();
    for (const [type, fn] of listeners) root.removeEventListener(type, fn);
    ctx.signal.removeEventListener('abort', dispose);
    root.remove();
  }
  if (ctx.signal.aborted) return { unmount: dispose };
  host.append(root);
  const listen = (type, fn) => {
    listeners.push([type, fn]);
    root.addEventListener(type, fn);
  };
  function filterList(filterKey, announce = false) {
    const entry = filterGroups.get(filterKey);
    if (!entry) return;
    const q = normalize(filters.get(filterKey));
    let count = 0;
    for (const option of entry.group.children) {
      if (option.dataset.unset) continue;
      option.hidden = !!q && !normalize(option.dataset.search).includes(q);
      if (!option.hidden) count++;
    }
    const message = q ? `${count} ${count === 1 ? 'match' : 'matches'}` : '';
    entry.count.textContent = message;
    if (announce) ctx.announce(message);
  }
  function filterBox(filterKey, label, group) {
    const box = make('label', null, 'ic-parts-filter');
    box.append(make('span', label));
    const input = make('input');
    input.type = 'search';
    input.dataset.filter = filterKey;
    input.dataset.key = key('filter', filterKey);
    input.value = filters.get(filterKey) || '';
    const count = make('span');
    box.append(input, count);
    filterGroups.set(filterKey, { group, count });
    return box;
  }
  function render() {
    if (disposed) return;
    let active = root.contains(doc.activeElement) ? doc.activeElement.dataset.key : null;
    const snap = ctx.configuration.snapshot();
    if (shown && shown.instrumentId !== snap.instrumentId) active = null;
    if (shown && (shown.instrumentId !== snap.instrumentId || shown.revision !== snap.revision)) {
      pending = null;
      failure = '';
    }
    shown = snap;
    if (instrument !== snap.instrumentId) {
      instrument = snap.instrumentId;
      open = new Set();
      initialized = false;
      more = new Set();
      filters = new Map();
    }
    filterGroups.clear();
    root.replaceChildren();
    root.setAttribute('aria-busy', String(snap.status === 'loading' || !!pending));
    const status = make('p', '', 'ic-parts-status');
    status.setAttribute('role', 'status');
    root.append(status);
    if (snap.status !== 'ready') {
      status.textContent = snap.status === 'error' ? snap.error.message : 'Loading parts…';
      if (
        snap.status === 'error' &&
        (lastErrorRevision !== snap.revision || lastErrorInstrument !== snap.instrumentId)
      ) {
        lastErrorRevision = snap.revision;
        lastErrorInstrument = snap.instrumentId;
        ctx.announce(snap.error.message);
      }
      return;
    }
    status.textContent = failure || snap.note || '';
    if (
      snap.note &&
      (lastNoteRevision !== snap.revision || lastNoteInstrument !== snap.instrumentId)
    ) {
      lastNoteRevision = snap.revision;
      lastNoteInstrument = snap.instrumentId;
      ctx.announce(snap.note);
    }
    if (!initialized) {
      if (snap.parts.length) open.add(snap.parts[0].id);
      initialized = true;
    }
    if (!snap.parts.length) {
      root.append(make('p', 'No customizable parts'));
      return;
    }
    for (const part of snap.parts) {
      const section = make('section', null, 'ic-parts-part');
      const heading = make('h3');
      const toggle = make('button', null, 'ic-parts-toggle');
      toggle.type = 'button';
      toggle.dataset.part = part.id;
      toggle.dataset.action = 'part';
      toggle.dataset.key = key('part', part.id);
      toggle.setAttribute('aria-expanded', String(open.has(part.id)));
      const current = part.variants.find((v) => v.id === part.value);
      toggle.append(
        make('span', part.name),
        make('span', (current?.name || 'Not set') + (part.pinned ? ' · your choice' : ''))
      );
      const count = part.variants.filter((v) => !v.alias_of).length;
      toggle.append(make('span', `${count} ${count === 1 ? 'option' : 'options'}`));
      heading.append(toggle);
      section.append(heading);
      if (open.has(part.id)) {
        const group = make('div', null, 'ic-parts-options');
        group.setAttribute('role', 'radiogroup');
        group.setAttribute('aria-label', part.name);
        function option(v) {
          const label = make('label', null, 'ic-parts-option');
          const radio = make('input');
          radio.type = 'radio';
          radio.name = `${groupPrefix}:${part.id}`;
          radio.dataset.part = part.id;
          radio.dataset.variant = v?.id || '';
          radio.dataset.key = key('option', part.id, v?.id || '');
          radio.checked = part.value === (v?.id || null);

          label.dataset.search = v ? [v.name || v.id, ...v.descriptors].join(' ') : 'Not set';
          if (!v) label.dataset.unset = '1';
          const id = `${groupPrefix}-${encodeURIComponent(part.id)}-${encodeURIComponent(v?.id || '')}`;
          const name = make('span', v?.name || 'Not set');
          name.id = id;
          const desc = make('span', null, 'ic-parts-descriptors');
          desc.id = `${id}-d`;
          radio.setAttribute('aria-labelledby', id);
          radio.setAttribute('aria-describedby', desc.id);
          const candidate = v?.descriptors || [];
          const now = new Set(current?.descriptors || []);
          const candidateSet = new Set(candidate);
          const deltas = candidate.map((text) => ({ text, type: now.has(text) ? 'kept' : 'adds' }));
          for (const text of now)
            if (!candidateSet.has(text)) deltas.push({ text, type: 'removes' });
          deltas.forEach(({ text, type }, index) => {
            if (index) desc.append(make('span', ', ', 'ic-parts-sr'));
            const item = make(type === 'removes' ? 'del' : 'span', null, `ic-parts-${type}`);
            item.dataset.delta = type;
            item.dataset.descriptor = text;
            if (type === 'adds') {
              const plus = make('span', '+ ');
              plus.setAttribute('aria-hidden', 'true');
              item.append(plus);
            }
            if (type !== 'kept') item.append(make('span', `${type} `, 'ic-parts-sr'));
            item.append(make('span', text));
            desc.append(item);
          });
          label.append(radio, name, desc);
          return label;
        }
        const native = part.variants.filter((v) => !v.expanded);
        const nativeKey = key('native', part.id);
        if (native.length > 10)
          section.append(
            filterBox(nativeKey, `Filter ${(part.name || '').toLowerCase()} options`, group)
          );
        group.append(option(null));
        for (const v of native) group.append(option(v));
        filterList(nativeKey);
        section.append(group);
        const expanded = part.variants.filter(
          (v) => v.expanded && (!v.alias_of || v.id === part.value)
        );
        if (expanded.length) {
          const button = make(
            'button',
            `More materials — any ${expanded[0].expanded === 'wood' ? 'wood' : 'string'} on any instrument (${expanded.length})`,
            'ic-parts-more'
          );
          button.type = 'button';
          button.dataset.action = 'more';
          button.dataset.part = part.id;
          button.dataset.key = key('more', part.id);
          button.setAttribute('aria-expanded', String(more.has(part.id)));
          section.append(button);
          if (more.has(part.id)) {
            const borrowed = make('div', null, 'ic-parts-options');
            borrowed.setAttribute('role', 'radiogroup');
            borrowed.setAttribute('aria-label', `More materials for ${part.name}`);
            const moreKey = key('more', part.id);
            section.append(filterBox(moreKey, `Search ${expanded.length} materials`, borrowed));
            for (const v of expanded) borrowed.append(option(v));
            filterList(moreKey);
            section.append(borrowed);
          }
        }
      }
      root.append(section);
    }
    if (active) {
      const target = [...root.querySelectorAll('[data-key]')].find(
        (el) => el.dataset.key === active
      );
      target?.focus({ preventScroll: true });
    }
  }
  listen('input', (event) => {
    const input = event.target;
    if (!input.dataset.filter) return;
    filters.set(input.dataset.filter, input.value);
    filterList(input.dataset.filter, true);
  });
  listen('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || !root.contains(button)) return;
    const set = button.dataset.action === 'part' ? open : more;
    if (set.has(button.dataset.part)) set.delete(button.dataset.part);
    else set.add(button.dataset.part);
    render();
  });
  listen('change', async (event) => {
    const input = event.target;
    if (!input.matches('input[type="radio"][data-part]') || disposed) return;
    const selectedPart = input.dataset.part;
    const selectedVariant = input.dataset.variant || null;
    if (pending) {
      render();
      return;
    }
    const token = {};
    const displayed = shown;
    pending = token;
    failure = '';
    // Keep the focused radio enabled during the pending action. Reconcile
    // browser-optimistic checked state immediately from the authoritative snapshot.
    for (const radio of root.querySelectorAll('input[type="radio"]')) {
      const part = displayed.parts.find((p) => p.id === radio.dataset.part);
      radio.checked = part.value === (radio.dataset.variant || null);
    }
    root.setAttribute('aria-busy', 'true');
    try {
      await ctx.configuration.choosePart({
        partId: selectedPart,
        variantId: selectedVariant,
        revision: displayed.revision,
      });
      // Re-read authoritative state: action promises may resolve out of order.
      if (!disposed && pending === token) {
        pending = null;
        render();
      }
    } catch (error) {
      if (disposed || pending !== token) return;
      pending = null;
      const now = ctx.configuration.snapshot();
      if (now.instrumentId !== displayed.instrumentId || now.revision !== displayed.revision) {
        render();
        return;
      }
      failure =
        typeof error?.message === 'string' ? error.message : 'The choice could not be applied.';
      render();
      ctx.announce(failure);
    }
  });
  unsubscribe = ctx.configuration.subscribe(render);
  ctx.signal.addEventListener('abort', dispose, { once: true });
  render();
  return { unmount: dispose };
}

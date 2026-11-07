// #670 rows 201–202. The shell owns canonical preview state and every mutation.
// Contract: #668 / 6646846068, amended by 6647373109. Notes, SVG URLs and
// search normalization are supplied by the canonical engine adapter.

export function mount(host, ctx) {
  if (ctx.signal.aborted) return { focus() {}, unmount() {} };
  const doc = host.ownerDocument;
  const controller = new AbortController();
  const { signal } = controller;
  const api = ctx.character;
  let disposed = false;
  let unsubscribe = () => {};
  let snapshot;
  let epoch = 0;
  let request = 0;
  let busy = false;
  let query = '';
  let timer;
  let actionError = '';
  let saveError = '';
  let recent = [];
  const open = new Set();
  const node = (tag, text, className) => {
    const el = doc.createElement(tag);
    if (text != null) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const root = node('section', null, 'ic-character');
  root.setAttribute('aria-label', 'Instrument character');
  const style = node('link');
  style.rel = 'stylesheet';
  style.href = new URL('./character.css', import.meta.url).href;
  const status = node('p', '', 'ic-status');
  status.tabIndex = -1;
  status.dataset.key = 'status';
  const content = node('div', null, 'ic-content');
  const current = node('p', '', 'ic-current');
  const automatic = node('button', 'Back to automatic');
  automatic.type = 'button';
  automatic.dataset.action = 'automatic';
  automatic.dataset.key = 'automatic';
  const help = node(
    'p',
    'Picking a character re-derives the parts, tuning, room and chain toward it. Back to automatic changes the character label without undoing those settings.',
    'ic-help'
  );
  const suggestion = node('div', null, 'ic-suggestion');
  const label = node('label', null, 'ic-search');
  label.append(node('span', 'Search characters'));
  const input = node('input');
  input.type = 'search';
  input.placeholder = 'Search characters';
  input.dataset.key = 'query';
  label.append(input);
  const summary = node('p', '', 'ic-count');
  const toolbar = node('div', null, 'ic-toolbar');
  for (const [action, text] of [
    ['expand', 'Expand all'],
    ['collapse', 'Collapse all'],
  ]) {
    const b = node('button', text);
    b.type = 'button';
    b.dataset.action = action;
    b.dataset.key = action;
    toolbar.append(b);
  }
  const recents = node('div', null, 'ic-recents');
  const categories = node('div', null, 'ic-categories');
  categories.setAttribute('role', 'group');
  categories.setAttribute('aria-label', 'Browse characters by category');
  const error = node('p', '', 'ic-error');
  const saved = node('p', '', 'ic-error');
  content.append(
    current,
    automatic,
    help,
    suggestion,
    label,
    summary,
    toolbar,
    recents,
    categories
  );
  root.append(status, content, error, saved);
  host.append(style, root);
  ctx.signal.addEventListener('abort', unmount, { once: true });

  try {
    const read = ctx.storage.read('recent');
    if (read.ok && Array.isArray(read.value)) {
      recent = [...new Set(read.value.filter((id) => typeof id === 'string'))].slice(0, 8);
    }
  } catch {
    // Recents are best-effort and start empty in this prototype namespace.
  }

  function entries() {
    return (snapshot.categories || []).flatMap((c) => c.prefaces);
  }
  function glyph(url) {
    const img = node('img', null, 'ic-glyph');
    img.alt = '';
    img.src = url;
    return img;
  }
  function chip(entry, where, axis2Only = false) {
    const b = node('button', null, 'ic-chip');
    if (!axis2Only && entry.glyph.category) b.append(glyph(entry.glyph.category));
    if (entry.glyph.entry) b.append(glyph(entry.glyph.entry));
    b.append(node('span', entry.id, 'ic-chip-label'));
    if (entry.note) b.title = entry.note;
    b.type = 'button';
    b.dataset.action = 'choose';
    b.dataset.preface = entry.id;
    b.dataset.key = JSON.stringify([where, entry.id]);
    b.setAttribute('aria-pressed', String(snapshot.current === entry.id));
    b.setAttribute('aria-disabled', String(busy));
    return b;
  }
  function chips(list, where, axis2Only = false) {
    const wrap = node('div', null, 'ic-chips');
    for (const entry of list) wrap.append(chip(entry, where, axis2Only));
    return wrap;
  }
  function restore(active) {
    if (!active || !root.contains(active) || !active.dataset.key) return null;
    return { element: active, key: active.dataset.key, preface: active.dataset.preface };
  }
  function render() {
    if (disposed) return;
    const focus = restore(doc.activeElement);
    const ready = snapshot?.status === 'ready';
    content.hidden = !ready;
    status.hidden = ready;
    status.textContent =
      snapshot?.status === 'error'
        ? snapshot.error?.message || 'Character could not be loaded.'
        : 'Loading character…';
    root.setAttribute('aria-busy', String(snapshot?.status === 'loading' || busy));
    error.textContent = actionError;
    error.hidden = !actionError;
    saved.textContent = saveError;
    saved.hidden = !saveError;
    if (ready) {
      const all = entries();
      const byId = new Map(all.map((e) => [e.id, e]));
      current.textContent =
        (snapshot.current || 'None') +
        ' · ' +
        (snapshot.automatic ? 'automatic, from the parts' : 'chosen');
      automatic.hidden = snapshot.automatic;
      automatic.setAttribute('aria-disabled', String(busy));
      suggestion.replaceChildren();
      const suggested = byId.get(snapshot.suggestion);
      if (suggested && suggested.id !== snapshot.current) {
        suggestion.append(node('span', 'Suggested for this sound'), chip(suggested, 'suggestion'));
      }
      suggestion.hidden = !suggestion.childNodes.length;
      // Search field remains the same node during updates and IME composition.
      if (input.value !== query) input.value = query;
      const q = api.normalize(query);
      toolbar.hidden = !!q;
      categories.replaceChildren();
      let count = 0;
      for (const category of snapshot.categories) {
        const list = category.prefaces.filter(
          (e) => !q || api.normalize(e.id).includes(q) || api.normalize(e.note || '').includes(q)
        );
        count += list.length;
        if (!list.length) continue;
        if (q) {
          const section = node('section', null, 'ic-category');
          section.append(
            node('h3', category.name + ' · ' + list.length),
            chips(list, category.id, true)
          );
          categories.append(section);
        } else {
          const details = node('details', null, 'ic-category');
          details.dataset.category = category.id;
          details.open = open.has(category.id);
          const heading = node('summary', category.name + ' · ' + list.length);
          heading.dataset.key = JSON.stringify(['category', category.id]);
          details.append(heading);
          if (details.open) details.append(chips(list, category.id, true));
          categories.append(details);
        }
      }
      summary.textContent = q
        ? count
          ? count + (count === 1 ? ' match' : ' matches')
          : 'No character matches “' + query + '”.'
        : all.length.toLocaleString('en') +
          ' characters · ' +
          snapshot.categories.length +
          ' categories';
      recents.replaceChildren();
      const recentEntries = q ? [] : recent.map((id) => byId.get(id)).filter(Boolean);
      if (recentEntries.length) {
        recents.append(node('span', 'Recently used'), chips(recentEntries, 'recent'));
      }
      recents.hidden = !recentEntries.length;
    }
    // Incidental refreshes never steal focus from an unrelated host/control.
    if (focus && (!focus.element.isConnected || focus.element.closest('[hidden]'))) {
      const visible = (el) => !el.closest('[hidden]');
      const targets = [...root.querySelectorAll('[data-key]')];
      const target =
        targets.find((el) => visible(el) && el.dataset.key === focus.key) ||
        (focus.preface &&
          targets.find((el) => visible(el) && el.dataset.preface === focus.preface)) ||
        (ready ? input : status);
      target.focus({ preventScroll: true });
    }
  }
  function refresh() {
    if (disposed) return;
    const next = api.snapshot();
    const selected = !snapshot || next.instrumentId !== snapshot.instrumentId;
    const changed = !snapshot || next.revision !== snapshot.revision || selected;
    if (selected) {
      epoch++;
      request++;
      query = '';
      clearTimeout(timer);
    }
    if (changed) {
      busy = false;
      actionError = '';
      clearTimeout(timer);
    }
    snapshot = next;
    render();
  }
  function recordRecent(id) {
    recent = [id, ...recent.filter((x) => x !== id)].slice(0, 8);
    let ok = false;
    try {
      ok = ctx.storage.write('recent', recent).ok;
    } catch {
      // Keep usable in-memory recents if storage throws despite its contract.
    }
    if (disposed) return;
    const prior = saveError;
    saveError = ok ? '' : 'Recently used characters are not saved on this device.';
    if (saveError !== prior) ctx.announce(saveError || 'Recently used characters are saved again.');
  }
  async function act(prefaceId) {
    if (disposed || busy || snapshot.status !== 'ready') return;
    const revision = snapshot.revision;
    const selectedEpoch = epoch;
    const ticket = ++request;
    busy = true;
    actionError = '';
    if (prefaceId != null) recordRecent(prefaceId);
    if (disposed || ticket !== request || selectedEpoch !== epoch || snapshot.revision !== revision)
      return;
    render();
    // Focus restoration can synchronously invoke host listeners that dispose or
    // change selection. Recheck immediately before dispatching to the engine.
    if (disposed || ticket !== request || selectedEpoch !== epoch || snapshot.revision !== revision)
      return;
    try {
      // Never adopt a promise result: it may arrive after a newer subscription.
      if (prefaceId == null) await api.automatic({ revision });
      else await api.choose({ prefaceId, revision });
      if (!disposed && ticket === request && selectedEpoch === epoch) {
        busy = false;
        refresh();
      }
    } catch (e) {
      if (disposed || ticket !== request || selectedEpoch !== epoch) return;
      busy = false;
      refresh();
      if (selectedEpoch !== epoch || ticket !== request || snapshot.revision !== revision) return;
      if (e?.code === 'STALE' || e === 'STALE') {
        actionError = e?.message || 'The instrument changed. Choose again.';
      } else {
        actionError = e?.message || 'The character change could not be applied.';
      }
      render();
      ctx.announce(actionError);
    }
  }
  root.addEventListener(
    'click',
    (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button || !root.contains(button)) return;
      if (button.dataset.action === 'choose') void act(button.dataset.preface);
      else if (button.dataset.action === 'automatic') void act(null);
      else {
        if (button.dataset.action === 'expand') {
          for (const c of snapshot.categories) open.add(c.id);
        } else open.clear();
        render();
      }
    },
    { signal }
  );
  root.addEventListener(
    'toggle',
    (e) => {
      const details = e.target;
      if (disposed || !details.dataset.category || !root.contains(details) || api.normalize(query))
        return;
      const category = snapshot.categories.find((c) => c.id === details.dataset.category);
      if (!category) return;
      if (details.open) {
        open.add(category.id);
        if (!details.querySelector('.ic-chips'))
          details.append(chips(category.prefaces, category.id, true));
      } else {
        open.delete(category.id);
        details.querySelector('.ic-chips')?.remove();
      }
    },
    { signal, capture: true }
  );
  input.addEventListener(
    'input',
    () => {
      query = input.value;
      clearTimeout(timer);
      render();
      const revision = snapshot.revision;
      timer = setTimeout(() => {
        if (!disposed && snapshot.revision === revision && api.normalize(query)) {
          ctx.announce(summary.textContent);
        }
      }, 600);
    },
    { signal }
  );

  function unmount() {
    if (disposed) return;
    disposed = true;
    request++;
    clearTimeout(timer);
    controller.abort();
    unsubscribe();
    ctx.signal.removeEventListener('abort', unmount);
    root.remove();
    style.remove();
  }
  try {
    if (!disposed) unsubscribe = api.subscribe(refresh);
    if (disposed) unsubscribe();
    else refresh();
  } catch (e) {
    unmount();
    throw e;
  }
  return {
    unmount,
    focus() {
      if (!disposed) (snapshot?.status === 'ready' ? input : status).focus();
    },
  };
}

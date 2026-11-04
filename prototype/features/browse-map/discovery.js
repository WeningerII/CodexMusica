// #670 rows 216–217 increment. Harness evidence does not complete manifest rows.
// P2 #739 ctx.items: frozen [{id, name, family, place}], catalog-owned or null.
// place: {lat,lng,label,region,provenance:{status,method?,on?}}; verified is human,
// reviewed is model-only, and unreviewed must never imply verification.
// Optional shell-owned ctx.map: {ready, select, highlight, onSelect}.
// onSelect emits genuine user map selections only; select/highlight never echo
// (#670, Don 6640163315). Real atlas protocol/storage isolation awaits upstream P3 work.
// The adapter owns geographic rendering; this module invents no coordinates.
export function mount(host, ctx) {
  const items = ctx.items || [];
  if (
    !ctx.signal ||
    typeof ctx.announce !== 'function' ||
    !ctx.storage ||
    items.some((i) => !i || typeof i.id !== 'string' || !i.id || typeof i.name !== 'string') ||
    new Set(items.map((i) => i.id)).size !== items.length
  ) {
    throw new TypeError('Discovery requires unique named items and the shell context.');
  }
  if (ctx.signal.aborted) return { unmount() {}, focus() {} };
  const doc = host.ownerDocument;
  const root = doc.createElement('section');
  root.className = 'proto-discovery';
  root.setAttribute('aria-label', 'Browse traditions');
  const style = doc.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./discovery.css', import.meta.url).href;
  root.innerHTML = `<p class="discovery-notice">Prototype discovery increment. Catalog and geographical map integration are pending.</p>
    <div class="discovery-controls"><button type="button" data-step="-1" aria-label="Previous traditions">Previous</button><button type="button" data-step="1" aria-label="Next traditions">Next</button></div>
    <div class="discovery-shelf" tabindex="-1" role="region" aria-label="Traditions, horizontally scrollable"><ul></ul></div>
    <p class="discovery-empty" hidden>No traditions are available.</p>
    <section class="discovery-detail" aria-label="Selected tradition" hidden><h2 tabindex="-1"></h2><p data-description></p><p data-location></p><p data-provenance></p><button type="button" data-close>Close details</button></section>
    <div class="discovery-map" aria-label="Geographical map"></div>`;
  host.append(style, root);
  const shelf = root.querySelector('.discovery-shelf');
  const list = shelf.querySelector('ul');
  const detail = root.querySelector('.discovery-detail');
  const buttons = new Map();
  const records = new Map(items.map((i) => [i.id, { ...i }]));
  let selected = null,
    opener = null,
    dead = false,
    mapReady = false,
    unsubscribe = null;
  const ids = [...records.keys()];
  const indices = new Map(ids.map((id, index) => [id, index]));
  let focusedIndex = 0;
  function rove(index, moveFocus = false) {
    if (dead || !ids.length) return;
    buttons.get(ids[focusedIndex]).tabIndex = -1;
    focusedIndex = Math.max(0, Math.min(ids.length - 1, index));
    const button = buttons.get(ids[focusedIndex]);
    button.tabIndex = 0;
    if (moveFocus) {
      button.focus({ preventScroll: true });
      button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }
  }
  function focusShelf() {
    if (!dead) {
      if (ids.length) rove(focusedIndex, true);
      else shelf.focus();
    }
  }
  const listeners = [];
  const on = (target, type, fn) => {
    target.addEventListener(type, fn, { signal: ctx.signal });
    listeners.push(() => target.removeEventListener(type, fn));
  };
  function save(id) {
    if (dead) return;
    try {
      if (ctx.storage.write('selection', id).ok) return '';
    } catch {
      /* Report refusals, including a throwing injected wrapper. */
    }
    return 'Selection changed, but could not be saved.';
  }
  function syncMap() {
    if (dead || !mapReady) return;
    try {
      if (selected !== null) ctx.map.select(selected);
      if (!dead) ctx.map.highlight(selected === null ? [] : [selected]);
    } catch {
      if (!dead) return 'Map selection could not be updated. Browsing is still available.';
    }
  }
  function select(id, source) {
    if (dead || (id !== null && !records.has(id))) return;
    if (id === selected) {
      if (id !== null && source === 'card' && detail.hidden) {
        detail.hidden = false;
        announceSelection(id, '');
      }
      return;
    }
    if (source === 'map') opener = null;
    if (selected !== null) buttons.get(selected).setAttribute('aria-pressed', 'false');
    selected = id;
    if (id !== null) buttons.get(id).setAttribute('aria-pressed', 'true');
    if (source === 'restore' && id !== null) rove(indices.get(id));
    detail.hidden = id === null;
    if (id !== null) {
      const item = records.get(id);
      detail.querySelector('h2').textContent = item.name;
      detail.querySelector('[data-description]').textContent = !item.family
        ? 'No family supplied.'
        : records.has(item.family)
          ? records.get(item.family).name
          : `Family label unavailable (catalog ID: ${item.family}).`;
      const place = item.place;
      detail.querySelector('[data-location]').textContent =
        place == null
          ? 'No fixed origin; this tradition remains available to browse.'
          : `${place.label} · ${place.region} · ${place.lat}, ${place.lng}`;
      const provenance = detail.querySelector('[data-provenance]');
      if (place == null) {
        provenance.textContent = 'No coordinate review applies.';
        provenance.removeAttribute('data-review-status');
      } else {
        const review = place.provenance || {};
        const labels = {
          verified: 'Human verified location.',
          reviewed: 'Model reviewed location; not human verified.',
          unreviewed: 'Unreviewed location; not human verified.',
        };
        const status = Object.hasOwn(labels, review.status) ? review.status : 'unreviewed';
        const redundant = new Set([
          status,
          status === 'reviewed' ? 'model' : status === 'verified' ? 'human' : '',
        ]);
        const method = typeof review.method === 'string' ? review.method.trim() : '';
        provenance.dataset.reviewStatus = status;
        provenance.textContent = [
          labels[status],
          method && !redundant.has(method.toLowerCase()) ? `Method: ${review.method}.` : '',
          typeof review.on === 'string' && review.on ? `Review date: ${review.on}.` : '',
        ]
          .filter(Boolean)
          .join(' ');
      }
    }
    let warning = '';
    if (source !== 'map') warning = syncMap() || '';
    else if (mapReady && !dead) {
      try {
        ctx.map.highlight(id === null ? [] : [id]);
      } catch {
        warning = 'Map highlight could not be updated.';
      }
    }
    warning = [warning, save(id)].filter(Boolean).join(' ');
    if (!dead && source !== 'restore') announceSelection(id, warning);
    else if (!dead && warning) ctx.announce(warning);
  }
  function announceSelection(id, warning) {
    if (dead) return;
    const item = records.get(id);
    const location = item?.place
      ? [item.place.label, item.place.region].filter(Boolean).join(', ')
      : 'No fixed origin';
    const message = item
      ? `${item.name}: ${location}. ${detail.querySelector('[data-provenance]').textContent}`
      : 'Selection cleared.';
    ctx.announce([message, warning].filter(Boolean).join(' '));
  }
  for (const item of records.values()) {
    const li = doc.createElement('li');
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'discovery-card';
    button.title = item.name;
    button.tabIndex = buttons.size === 0 ? 0 : -1;
    button.setAttribute('aria-pressed', 'false');
    const label = doc.createElement('span');
    label.textContent = item.name;
    button.append(label);
    li.append(button);
    list.append(li);
    buttons.set(item.id, button);
    on(button, 'focus', () => rove(indices.get(item.id)));
    on(button, 'click', () => {
      rove(indices.get(item.id));
      opener = button;
      select(item.id, 'card');
    });
  }
  root.querySelector('.discovery-empty').hidden = items.length !== 0;
  shelf.tabIndex = items.length ? -1 : 0;
  function edges() {
    if (dead) return;
    root.querySelector('[data-step="-1"]').disabled = shelf.scrollLeft <= 1;
    root.querySelector('[data-step="1"]').disabled =
      shelf.scrollLeft >= shelf.scrollWidth - shelf.clientWidth - 1;
  }
  function scroll(step) {
    // Instant movement also preserves reduced-motion behavior without media listeners.
    shelf.scrollBy({ left: step * Math.max(1, shelf.clientWidth * 0.85), behavior: 'instant' });
    edges();
  }
  for (const button of root.querySelectorAll('[data-step]'))
    on(button, 'click', () => scroll(Number(button.dataset.step)));
  on(shelf, 'scroll', edges);
  on(style, 'load', edges);
  on(shelf, 'keydown', (event) => {
    // Only a card itself (or programmatically focused shelf) owns navigation.
    // Nested controls and editable fields retain their native keys.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const card = buttons.get(ids[focusedIndex]);
    if (event.target !== shelf && event.target !== card) return;
    const target = {
      ArrowLeft: focusedIndex - 1,
      ArrowRight: focusedIndex + 1,
      Home: 0,
      End: ids.length - 1,
    }[event.key];
    if (target === undefined || !ids.length) return;
    event.preventDefault();
    rove(target, true);
  });
  on(detail.querySelector('[data-close]'), 'click', () => {
    // Closing a disclosure does not clear the shared selected tradition.
    detail.hidden = true;
    if (opener?.isConnected) opener.focus();
    else focusShelf();
  });
  const mapHost = root.querySelector('.discovery-map');
  let observer;
  function unmount() {
    if (dead) return;
    dead = true;
    for (const remove of listeners) remove();
    ctx.signal.removeEventListener('abort', unmount);
    observer?.disconnect();
    try {
      unsubscribe?.();
    } finally {
      root.remove();
      style.remove();
    }
  }
  ctx.signal.addEventListener('abort', unmount, { once: true });
  try {
    mapHost.textContent = ctx.map
      ? 'Geographical map adapter is preparing.'
      : 'Geographical map adapter is not connected.';
    if (ctx.map)
      Promise.resolve(ctx.map.ready)
        .then(() => {
          if (dead) return;
          mapReady = true;
          const release = ctx.map.onSelect((id) => select(id, 'map'));
          // Subscription itself may synchronously trigger shell teardown.
          if (dead) {
            release();
            return;
          }
          unsubscribe = release;
          mapHost.textContent =
            'Map adapter connected; atlas preservation awaits integrated validation.';
          const warning = syncMap();
          if (!dead && warning) ctx.announce(warning);
        })
        .catch(() => {
          if (!dead) ctx.announce('Geographical map is unavailable. Browsing is still available.');
        });
    let saved;
    try {
      saved = ctx.storage.read('selection');
    } catch {
      saved = { ok: false };
    }
    if (dead) return { unmount, focus() {} };
    if (!saved.ok) ctx.announce('Saved selection could not be read. Browsing is still available.');
    if (saved.ok && records.has(saved.value)) select(saved.value, 'restore');
    if (dead) return { unmount, focus() {} };
    observer = new ResizeObserver(edges);
    observer.observe(shelf);
    edges();
  } catch (error) {
    unmount();
    throw error;
  }
  return {
    unmount,
    focus() {
      focusShelf();
    },
  };
}

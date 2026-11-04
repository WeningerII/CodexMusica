// #670 isolated prototype. Injected data/callbacks are not production adapters.
// Contract 6640163315 replaces flat collections with frozen normalized shelves:
// ctx.shelves: [{language, languageLabel, total, cards: [Card]}].
// Card: {id,title,language,readable,recorded,art,first,artworkUrl?,artworkLabel?}.
// ctx.loadMore(language,count) -> Promise<{cards: only new Card[], total}>.
// The shell owns projection, loading, ordering and snapshot checks.
// ctx.openCollection(id), ctx.openReading(collectionId), ctx.showCredit(art).
// Contract 6640718497: Play passes only card.id; shell resolves/routes.
// openReading returns {unitId}, ignored here; rejects with {code,message}.
// ctx.selection: { state(id): 'none'|'some'|'all', toggle(id), subscribe(fn) }.
// Missing adapters are visibly disabled. This lane never loads catalog data.
// P1 reference: 2a3d9928078a68eaf8b0c20e76c903a535971cb8.
// Native overflow/index restoration follow src/library/core.js:671–745;
// shelf-only Arrow handling follows :871–880, not the stale looping matrix.
// ctx.storage is already lane-scoped; read/write return { ok, value?, reason? }.
export function mount(host, ctx) {
  if ('recipe' in ctx) throw new TypeError('Library context must not contain a recipe object.');
  const doc = host.ownerDocument;
  let alive = !ctx.signal.aborted;
  const timers = new Set();
  const cleanups = [];
  const sections = [];
  const selectionRefreshers = [];
  let unsubscribe;
  const abortObserver = new AbortController();
  const stop = () => {
    alive = false;
    timers.forEach(clearTimeout);
    timers.clear();
    cleanups.forEach((cleanup) => cleanup());
    const release = unsubscribe;
    unsubscribe = undefined;
    try { release?.(); } finally { abortObserver.abort(); }
  };
  const batch = 24; // P1 core.js:385; initial catalog previews contain at most 12.
  const active = () => alive && !ctx.signal.aborted;
  const el = (tag, text, className) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const listen = (node, type, fn, options = {}) => {
    const guarded = (event) => { if (active()) fn(event); };
    node.addEventListener(type, guarded, { ...options, signal: ctx.signal });
    cleanups.push(() => node.removeEventListener(type, guarded, options));
  };
  const announce = (text) => { if (active()) ctx.announce(text); };
  const link = el('link');
  link.rel = 'stylesheet';
  link.href = new URL('./explore.css', import.meta.url).href;
  const root = el('div', undefined, 'prototype-library-explore');
  root.append(el('p', 'Prototype: catalog loading and actions use injected shell adapters.', 'library-prototype-note'));
  if (!alive) return { unmount() {}, focus() {} };
  host.append(link, root);

  const pendingActions = new WeakSet();
  const run = async (button, operation, done) => {
    if (!active() || button.disabled || pendingActions.has(button)) return;
    pendingActions.add(button);
    // aria-disabled blocks repeat activation through our guard without removing
    // focus as native disabled would. Never restore focus over a user's move.
    button.setAttribute('aria-disabled', 'true');
    button.setAttribute('aria-busy', 'true');
    try {
      await operation(); // The shell owns routing; returned unitId is ignored.
      if (active()) done?.();
    } catch (error) {
      // Visible NO_READABLE feedback is a deliberate UX change, pending Jony,
      // not production parity. All four Play errors use the supplied message.
      announce(error?.message || 'Library action could not finish. Try again.');
    } finally {
      pendingActions.delete(button);
      if (active()) {
        button.removeAttribute('aria-disabled');
        button.removeAttribute('aria-busy');
      }
    }
  };

  // Observe lifecycle abort with a separate signal: using ctx.signal here
  // would remove this observer before its abort event could release adapters.
  ctx.signal.addEventListener('abort', stop, { once: true, signal: abortObserver.signal });
  for (const shelf of ctx.shelves || []) {
    const label = shelf.languageLabel || shelf.language;
    const collections = [...shelf.cards];
    const total = shelf.total;
    const section = el('section', undefined, 'library-prototype-shelf');
    section.dataset.language = shelf.language;
    const heading = el('h2', label);
    const count = el('p');
    const countText = el('span');
    count.append(countText);
    const note = el('span');
    count.append(note);
    const scroll = el('div', undefined, 'library-prototype-scroll');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'group');
    scroll.setAttribute('aria-label', `${label} collections, scroll horizontally`);
    // Physical scrolling remains left-to-right even for RTL titles.
    scroll.dir = 'ltr';
    section.append(heading, count, scroll);
    root.append(section);
    sections.push(scroll);
    let pending = false;
    let timer;
    let unsaved = false;
    let ready = false;
    let lastPosition = 0;
    const storageKey = `shelf-position-${shelf.language}`;
    const mark = (failed) => {
      if (!active()) return;
      note.textContent = failed ? ' · position unsaved' : '';
      if (failed !== unsaved) announce(failed
        ? `${label} position unsaved on this device.`
        : `${label} position saved.`);
      unsaved = failed;
    };
    const more = el('button', undefined, 'library-prototype-more');
    more.type = 'button';
    const stride = () => {
      const cards = scroll.querySelectorAll('.library-prototype-card');
      return cards.length > 1
        ? cards[1].offsetLeft - cards[0].offsetLeft
        : (cards[0]?.getBoundingClientRect().width || 172) + 14;
    };
    const card = (collection) => {
      const article = el('article', undefined, 'library-prototype-card');
      article.dataset.collection = collection.id;
      article.tabIndex = -1;
      article.dir = 'auto';
      if (collection.artworkUrl) {
        const image = el('img');
        image.src = collection.artworkUrl;
        image.alt = collection.artworkLabel || '';
        image.loading = 'lazy';
        article.append(image);
      } else {
        const cover = el('div', collection.title, 'library-prototype-cover');
        cover.setAttribute('aria-hidden', 'true');
        article.append(cover);
      }
      article.append(el('h3', collection.title), el('p', `${collection.readable} readable · ${collection.recorded} recorded units`));
      const addAction = (label, handler) => {
        const button = el('button', label);
        button.type = 'button';
        button.disabled = !handler;
        if (!handler) button.title = 'Shell adapter not connected';
        else listen(button, 'click', () => run(button, handler));
        article.append(button);
        return button;
      };
      addAction('Open collection', ctx.openCollection && (() => ctx.openCollection(collection.id)));
      addAction('Play first reading', ctx.openReading
        ? () => ctx.openReading(collection.id) : null);
      const selectionReady = ctx.selection?.state && ctx.selection?.toggle && ctx.selection?.subscribe;
      const select = addAction('Select readable units', null);
      const refresh = () => {
        if (!active()) return;
        const state = ctx.selection?.state?.(collection.id);
        select.setAttribute('aria-pressed', state === 'all' ? 'true' : state === 'some' ? 'mixed' : 'false');
      };
      refresh();
      selectionRefreshers.push(refresh);
      if (selectionReady) {
        select.disabled = false;
        select.removeAttribute('title');
        listen(select, 'click', () => run(select,
          () => ctx.selection.toggle(collection.id), refresh));
      }
      addAction('Artwork credit', collection.art && ctx.showCredit
        ? () => ctx.showCredit(collection.art) : null);
      return article;
    };
    const update = () => {
      const remaining = total - collections.length;
      countText.textContent = `${collections.length} of ${total} collections`;
      more.hidden = remaining === 0;
      more.disabled = !ready || typeof ctx.loadMore !== 'function';
      // Keep keyboard focus while loading; the pending guard blocks activation.
      more.setAttribute('aria-disabled', String(pending || more.disabled));
      more.textContent = pending ? 'Loading collections…' : `Show ${Math.min(batch, remaining)} more of ${remaining}`;
      more.setAttribute('aria-busy', String(pending));
    };
    const load = async (requested, explicit = false) => {
      if (!active() || pending || collections.length >= total || typeof ctx.loadMore !== 'function') return 0;
      pending = true;
      update();
      try {
        const result = await ctx.loadMore(shelf.language, requested);
        if (!active()) return 0;
        // Contract violations are rejected atomically, not deduplicated/sorted or
        // interpreted as a new catalog. Only the shell reports DATA_CHANGED.
        const ids = new Set(collections.map((c) => c.id));
        const valid = result && result.total === total && Array.isArray(result.cards)
          && result.cards.length <= requested && collections.length + result.cards.length <= total
          && result.cards.every((c) => c && typeof c.id === 'string' && c.language === shelf.language
            && c.readable > 0 && !ids.has(c.id) && ids.add(c.id));
        if (!valid) throw { message: 'Invalid shelf response; existing collections retained.' };
        const firstNew = result.cards.length ? card(result.cards[0]) : null;
        if (firstNew) scroll.insertBefore(firstNew, more);
        for (const c of result.cards.slice(1)) scroll.insertBefore(card(c), more);
        collections.push(...result.cards);
        // Deliberate prototype treatment, pending Jony: focus the first new
        // card after explicit expansion, unless the user has since moved focus.
        // Restoration and late responses never steal focus from nested controls.
        if (explicit && firstNew && doc.activeElement === more) {
          firstNew.focus({ preventScroll: true });
          firstNew.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        }
        if (explicit) announce(result.cards.length
          ? `${collections.length} of ${total} ${label} collections shown.`
          : `No additional ${label} collections returned. Try again.`);
        return result.cards.length;
      } catch (error) {
        if (active()) announce(`${label}: ${error?.code ? `${error.code}: ` : ''}${error?.message || 'Collections could not load. Try again.'}`);
        return 0;
      } finally {
        if (active()) { pending = false; update(); }
      }
    };
    scroll.append(more);
    for (const c of collections) scroll.insertBefore(card(c), more);
    update();
    listen(more, 'click', () => { if (ready) void load(Math.min(batch, total - collections.length), true); });
    listen(scroll, 'keydown', (event) => {
      if (event.target !== scroll || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      scroll.scrollBy({ left: stride() * (event.key === 'ArrowLeft' ? -1 : 1), behavior: 'instant' });
    });
    listen(scroll, 'scroll', () => {
      if (!ready) return;
      clearTimeout(timer);
      timers.delete(timer);
      timer = setTimeout(async () => {
        timers.delete(timer);
        if (!active()) return;
        try {
          const position = Math.max(0, Math.min(collections.length - 1, Math.round(scroll.scrollLeft / stride())));
          if (position === lastPosition) return;
          lastPosition = position;
          const result = await ctx.storage.write(storageKey, position);
          mark(!result?.ok);
        } catch { mark(true); }
      }, 500);
      timers.add(timer);
    }, { passive: true });
    // Await CSS before measuring; no frame/global event listener is needed.
    Promise.all([
      Promise.resolve().then(() => active() ? ctx.storage.read(storageKey) : { ok: true }).catch(() => ({ ok: false })),
      new Promise((resolve) => {
        if (link.sheet) resolve();
        else {
          listen(link, 'load', resolve, { once: true });
          listen(link, 'error', resolve, { once: true });
        }
      }),
    ]).then(async ([result]) => {
      if (!active()) return;
      mark(!result?.ok);
      const value = result?.value;
      const pos = Number.isFinite(value) ? Math.max(0, Math.min(total - 1, Math.floor(value))) : 0;
      // A partial batch is useful, but an empty/refused batch must not spin.
      while (active() && pos >= collections.length && collections.length < total) {
        const added = await load(Math.min(total - collections.length, Math.max(batch, pos + 1 - collections.length)));
        if (!added) break;
      }
      if (!active()) return;
      if (pos < collections.length) scroll.scrollLeft = pos * stride();
      else announce(`${label} saved position could not be restored; loaded collections remain available.`);
      // Ignore initial/restoration snap events at the same card index.
      lastPosition = Math.max(0, Math.round(scroll.scrollLeft / stride()));
      ready = true;
      update();
    });
  }
  if (active() && ctx.selection?.subscribe) {
    const release = ctx.selection.subscribe(() => {
      if (active()) selectionRefreshers.forEach((refresh) => refresh());
    });
    if (active()) unsubscribe = release;
    else release?.();
  }
  return {
    focus() { if (active()) sections[0]?.focus(); },
    unmount() {
      stop();
      root.remove();
      link.remove();
    },
  };
}

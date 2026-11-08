// #670 row 207. Rankings, selection/trail, recipe mutation and outcomes belong
// to the host (contract #6686647783903). No preview card enters this module.
export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const events = new AbortController();
  const sheet = doc.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = new URL('./similar.css', import.meta.url).href;
  const root = doc.createElement('section');
  root.className = 'instrument-similar';
  root.setAttribute('aria-label', 'Similar instruments');
  const heading = node('h3', 'Similar instruments');
  heading.tabIndex = -1;
  const status = node('p');
  status.setAttribute('role', 'status');
  status.tabIndex = -1;
  const retry = node('button', 'Retry');
  retry.type = 'button';
  retry.hidden = true;
  const list = node('ul');
  list.setAttribute('role', 'list');
  root.append(heading, status, retry, list);
  host.append(sheet, root);
  let disposed = false;
  let request;
  let generation = 0;
  let selected = null;
  let loaded = false;
  let failed = false;
  let pending = false;
  let unsubscribe = () => {};
  let rows = new Map();

  function node(tag, text) {
    const el = doc.createElement(tag);
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function focus() {
    if (!disposed)
      (list.querySelector('.instrument-similar-open:not(:disabled)') || heading).focus();
  }
  function snapshot() {
    return ctx.recipe.snapshot();
  }
  function available(row, navigation = false) {
    const s = snapshot();
    const a = s.instrumentActions;
    return (
      !disposed &&
      rows.get(row.record.id) === row &&
      a?.instrumentId === selected &&
      s.status === 'ready' &&
      !s.busy &&
      (!navigation || a.status === 'ready')
    );
  }
  function command(run) {
    // Recipe outcomes and navigation refusals are announced by the host.
    // Catch both synchronous and asynchronous refusal without a second owner.
    Promise.resolve()
      .then(() => {
        if (!disposed) return run();
      })
      .catch(() => {});
  }
  function updateControls() {
    for (const row of rows.values()) {
      row.open.disabled = !available(row, true);
      row.add.disabled = !available(row);
      updatePhoto(row);
    }
  }
  function updatePhoto(row) {
    const photo = row.record.photo;
    const src = Array.isArray(photo) ? ctx.media.resolve(photo[0]) : null;
    const key = JSON.stringify([photo, src, row.record.glyphUrl]);
    if (row.photoKey === key) return;
    row.photoKey = key;
    const token = ++row.photoToken;
    const showGlyph = () => {
      row.image.removeAttribute('src');
      row.credit.textContent = '';
      row.credit.hidden = true;
      row.photoAvailable = false;
      row.media.setAttribute('aria-disabled', 'true');
      row.media.tabIndex = -1;
      row.media.setAttribute('aria-label', row.record.name);
      const glyph = row.record.glyphUrl;
      row.image.hidden = !glyph?.startsWith('data:image/svg+xml');
      if (!row.image.hidden) row.image.src = glyph;
    };
    // Keep the media button and image node even when availability changes.
    // A focused failed photo remains focused, but cannot open the lightbox.
    row.image.onload = null;
    row.image.onerror = null;
    showGlyph();
    if (!src) return;
    row.image.hidden = false;
    row.image.onload = () => {
      if (disposed || rows.get(row.record.id) !== row || row.photoToken !== token) return;
      row.photoAvailable = true;
      row.media.removeAttribute('aria-disabled');
      row.media.tabIndex = 0;
      row.media.setAttribute('aria-label', `Enlarge photo of ${row.record.name}`);
      row.credit.textContent = `Photo: ${photo[2] || 'uncredited'} · ${photo[1] || 'licence not stated'}`;
      row.credit.hidden = false;
    };
    row.image.onerror = () => {
      if (disposed || rows.get(row.record.id) !== row || row.photoToken !== token) return;
      row.image.onload = null;
      row.image.onerror = null;
      showGlyph();
    };
    row.image.src = src;
  }
  function makeRow(record) {
    const li = node('li');
    const media = node('button');
    media.type = 'button';
    media.className = 'instrument-similar-media';
    const image = node('img');
    image.alt = '';
    image.width = image.height = 28;
    media.append(image);
    const open = node('button');
    open.type = 'button';
    open.className = 'instrument-similar-open';
    const name = node('span');
    const agreements = node('span');
    agreements.className = 'instrument-similar-agreements';
    const credit = node('span');
    credit.className = 'instrument-similar-credit';
    open.append(name, agreements, credit);
    const listen = node('a', 'Listen');
    listen.target = '_blank';
    listen.rel = 'noopener noreferrer';
    const add = node('button', 'Add');
    add.type = 'button';
    const row = {
      record,
      li,
      media,
      image,
      open,
      name,
      agreements,
      credit,
      listen,
      add,
      photoKey: null,
      photoToken: 0,
      photoAvailable: false,
    };
    li.append(media, open, listen, add);
    open.addEventListener(
      'click',
      () => {
        if (!available(row, true)) return;
        const a = snapshot().instrumentActions;
        const origin = selected;
        command(() =>
          ctx.openInstrument(row.record.id, {
            similar: true,
            fromInstrumentId: origin,
            previewRevision: a.previewRevision,
            returnFocus: open,
          })
        );
      },
      { signal: events.signal }
    );
    add.addEventListener(
      'click',
      () => {
        if (!available(row)) return;
        const s = snapshot();
        command(() =>
          ctx.recipe.addInstrument({
            instrumentId: row.record.id,
            destination: s.instrumentActions.destination,
            revision: s.revision,
          })
        );
      },
      { signal: events.signal }
    );
    media.addEventListener(
      'click',
      () => {
        if (!disposed && rows.get(row.record.id) === row && row.photoAvailable)
          command(() =>
            ctx.openPhoto(row.record.photo, { label: row.record.name, returnFocus: media })
          );
      },
      { signal: events.signal }
    );
    return row;
  }
  function render(record) {
    const next = new Map();
    for (const neighbour of record.neighbours) {
      const row = rows.get(neighbour.id) || makeRow(neighbour);
      row.record = neighbour;
      row.name.textContent = neighbour.name;
      row.agreements.textContent = `Closest on ${neighbour.agreements.join(', ')}`;
      row.add.setAttribute('aria-label', `Add ${neighbour.name} with catalog defaults`);
      row.listen.hidden = !neighbour.listenHref;
      if (neighbour.listenHref) row.listen.href = neighbour.listenHref;
      else row.listen.removeAttribute('href');
      row.listen.setAttribute('aria-label', `Listen to ${neighbour.name} on YouTube`);
      next.set(neighbour.id, row);
    }
    for (const [id, row] of rows) if (!next.has(id)) row.li.remove();
    rows = next;
    // Avoid moving an already-positioned row, preserving its focused child.
    let cursor = list.firstElementChild;
    for (const row of rows.values()) {
      if (row.li !== cursor) list.insertBefore(row.li, cursor);
      cursor = row.li.nextElementSibling;
    }
    updateControls();
  }
  async function load(moveFocus = false) {
    const id = snapshot().instrumentActions?.instrumentId || null;
    if (disposed) return;
    const seq = ++generation;
    request?.abort();
    request = new AbortController();
    if (id !== selected) {
      selected = id;
      loaded = false;
      pending = false;
      rows = new Map();
      list.replaceChildren();
    }
    failed = false;
    retry.hidden = true;
    if (!id) {
      status.textContent = 'Select an instrument';
      status.hidden = false;
      root.removeAttribute('aria-busy');
      return;
    }
    status.textContent = loaded ? '' : 'Loading similar instruments…';
    status.hidden = loaded;
    pending = true;
    root.setAttribute('aria-busy', 'true');
    if (moveFocus) {
      status.hidden = false;
      status.textContent = 'Loading similar instruments…';
      status.focus();
    }
    try {
      const record = await ctx.loadInstrumentSimilar(id, { signal: request.signal });
      if (disposed || seq !== generation || snapshot().instrumentActions?.instrumentId !== id)
        return;
      const restore = moveFocus && doc.activeElement === status;
      render(record);
      loaded = true;
      status.textContent = '';
      status.hidden = true;
      if (restore) focus(); // Empty success focuses the heading; no diagnosis.
    } catch (error) {
      if (disposed || seq !== generation || snapshot().instrumentActions?.instrumentId !== id)
        return;

      const restore = moveFocus && doc.activeElement === status;
      failed = true;
      status.hidden = false;
      status.textContent =
        error.code === 'NOT_FOUND'
          ? 'This instrument isn’t in the catalog’s data. Select another instrument.'
          : 'This instrument’s details couldn’t load. Try again.';
      retry.hidden = false;
      if (restore) retry.focus();
    } finally {
      if (!disposed && seq === generation) {
        pending = false;
        root.removeAttribute('aria-busy');
      }
    }
  }
  function changed() {
    if (disposed) return;
    updateControls();
    const id = snapshot().instrumentActions?.instrumentId || null;
    // Refresh the immutable projection on host updates (including new photos),
    // preserving nodes. Failed calls wait for explicit Retry.
    if (id !== selected || (!failed && !pending)) void load();
  }
  function unmount() {
    if (disposed) return;
    disposed = true;
    generation++;
    request?.abort();
    events.abort();
    unsubscribe();
    for (const row of rows.values()) {
      row.image.onload = null;
      row.image.onerror = null;
    }
    ctx.signal.removeEventListener('abort', unmount);
    sheet.remove();
    root.remove();
  }
  retry.addEventListener(
    'click',
    () => {
      void load(true);
    },
    { signal: events.signal }
  );
  if (ctx.signal.aborted) unmount();
  else {
    unsubscribe = ctx.recipe.subscribe(changed);
    ctx.signal.addEventListener('abort', unmount, { once: true });
    void load();
  }
  return { focus, unmount };
}

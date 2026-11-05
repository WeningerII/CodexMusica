// #670 identity header only. Shell ctx and real glyph parity depend on #755.
// No configuration, Background, recipe, selection setters or overlay ownership.
export function mount(host, ctx) {
  const doc = host.ownerDocument;
  let events = new AbortController();
  let request = null;
  let generation = 0;
  let disposed = false;
  let unsubscribe = () => {};
  const sheet = doc.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = new URL('./detail.css', import.meta.url).href;
  const root = doc.createElement('section');
  root.className = 'instrument-detail';
  root.setAttribute('aria-label', 'Instrument identity');
  host.append(sheet, root);

  function node(tag, text, className) {
    const el = doc.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function focus() {
    root.querySelector('h2, button')?.focus();
  }
  function message(text) {
    events.abort();
    events = new AbortController();
    const title = node('h2', text);
    title.tabIndex = -1;
    root.replaceChildren(title);
  }
  function render(record) {
    events.abort();
    events = new AbortController();
    const heading = node('h2', record.name);
    heading.tabIndex = -1;
    const classification = node(
      'p',
      `${record.family.name} › ${record.class.name}`,
      'instrument-detail-class'
    );
    const identity = node('p', `${record.short || ''} · catalog id `);
    identity.append(node('code', record.id));
    const copy = node('div');
    copy.append(classification, heading, identity);
    const hero = node('div', undefined, 'instrument-detail-hero');
    const media = node('div', undefined, 'instrument-detail-media');
    const glyph = () => {
      media.replaceChildren();
      if (typeof record.glyphUrl === 'string' && record.glyphUrl.startsWith('data:image/svg+xml')) {
        const img = node('img');
        img.alt = '';
        img.width = img.height = 96;
        img.src = record.glyphUrl;
        img.addEventListener('error', () => img.remove(), { signal: events.signal, once: true });
        media.append(img);
      }
    };
    glyph();
    hero.append(copy, media);
    root.replaceChildren(hero);
    const photo = record.photo;
    if (!Array.isArray(photo) || typeof photo[0] !== 'string') return;
    const caption = `Photo: ${photo[2] || 'uncredited'} · ${photo[1] || 'licence not stated'}`;
    const credit = node('p', undefined, 'instrument-detail-credit');
    let source = null;
    try {
      const url = new URL(photo[3]);
      if (url.protocol === 'https:' && !url.username && !url.password) source = url.href;
    } catch {
      /* No usable source link; retain the credit as text. */
    }
    if (source) {
      const link = node('a', caption);
      link.href = source;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      credit.append(link);
    } else credit.textContent = caption;
    root.append(credit);
    const unavailable = node(
      'p',
      'The catalog photo is unavailable in this prototype.',
      'instrument-detail-note'
    );
    const src = ctx.media.resolve(photo[0]);
    if (!src) {
      root.append(unavailable);
      return;
    }
    const button = node('button');
    button.type = 'button';
    button.setAttribute('aria-label', `Enlarge photo of ${record.name}`);
    const img = node('img');
    img.alt = '';
    img.width = img.height = 96;
    img.src = src;
    button.append(img);
    button.addEventListener(
      'click',
      () => ctx.openPhoto(photo, { label: record.name, returnFocus: button }),
      { signal: events.signal }
    );
    img.addEventListener(
      'error',
      () => {
        const hadFocus = doc.activeElement === button;
        glyph();
        root.append(unavailable);
        if (hadFocus) heading.focus();
      },
      { signal: events.signal, once: true }
    );
    media.replaceChildren(button);
  }
  async function update(moveFocus = false) {
    if (disposed) return;
    const seq = ++generation;
    request?.abort();
    request = new AbortController();
    const id = ctx.instrument.current();
    root.removeAttribute('aria-busy');
    if (!id) {
      message('Select an instrument');
      return;
    }
    message('Loading instrument…');
    const loading = root.querySelector('h2');
    if (moveFocus) loading.focus();
    root.setAttribute('aria-busy', 'true');
    try {
      const record = await ctx.loadInstrument(id, { signal: request.signal });
      if (disposed || seq !== generation) return;
      const restoreFocus = moveFocus && doc.activeElement === loading;
      render(record);
      if (restoreFocus) focus();
    } catch (error) {
      if (disposed || seq !== generation) return;
      const restoreFocus = moveFocus && doc.activeElement === loading;
      if (error.name === 'AbortError') {
        message('Instrument loading was cancelled.');
        if (restoreFocus) focus();
        return;
      }
      const text =
        error.code === 'NOT_FOUND'
          ? 'This instrument isn’t in the catalog’s data. Select another instrument.'
          : 'This instrument’s details couldn’t load. Try again.';
      message(text);
      if (error.code !== 'NOT_FOUND') {
        const retry = node('button', 'Retry');
        retry.type = 'button';
        retry.addEventListener('click', () => update(true), { signal: events.signal });
        root.append(retry);
        if (restoreFocus) retry.focus();
      } else if (restoreFocus) focus();
      ctx.announce(text);
    } finally {
      if (!disposed && seq === generation) root.removeAttribute('aria-busy');
    }
  }
  function unmount() {
    if (disposed) return;
    disposed = true;
    generation++;
    request?.abort();
    events.abort();
    unsubscribe();
    ctx.signal.removeEventListener('abort', unmount);
    sheet.remove();
    root.remove();
  }
  if (ctx.signal.aborted) unmount();
  else {
    unsubscribe = ctx.instrument.subscribe(() => update());
    ctx.signal.addEventListener('abort', unmount, { once: true });
    void update();
  }
  return { focus, unmount };
}

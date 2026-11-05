// #670 partial rows 170/175/177/210; all remain pending. No claim on 88/211.
// Production: src/pages/genre.js blob 47078396261039a6d18e97edbe1c242d2b440f80
// (gpDetail, gpBackground, gpBgAboutHTML, gpBgRecordingsHTML, gpImage/gpCredit).
// Contract: #668 comments 6645589522 and 6645704407. The shell owns selection,
// frozen records, data loading and the photo overlay. This lane owns no storage.
// Receipt 6645861833 (#755 cff4b189d6): abort cancels this caller's wait only,
// never the shared underlying read. Retired IDs resolve to live record IDs;
// freshness is decided by generation/disposal, not requested-ID equality.
// openPhoto currently announces viewer unavailability and restores trigger focus;
// passing the trigger does not establish integration with #748's actual overlay.
// Background is presented alone: other tabs, cross-listings, taxonomy navigation,
// recipe actions and opening/closing a detail from Browse are later slices.
// Listen is text only. HTTPS attribution links remain ordinary user-clicked links.
// All images must resolve through ctx.media to a committed same-origin URL.

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const life = new AbortController();
  const stylesheet = doc.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./detail.css', import.meta.url).href;
  const root = doc.createElement('article');
  root.className = 'pgd';
  root.setAttribute('aria-label', 'Genre detail');
  let disposed = false;
  let generation = 0;
  let pending = null;
  let view = null;
  let unsubscribe = null;
  let focusTarget = null;

  function node(tag, text, parent = root, className) {
    const el = doc.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    parent.append(el);
    return el;
  }
  function listen(el, type, fn) {
    el.addEventListener(type, fn, { signal: view.signal });
  }
  function clearView() {
    view?.abort();
    view = new AbortController();
    root.replaceChildren();
  }
  function message(text, state) {
    clearView();
    root.dataset.state = state;
    root.setAttribute('aria-busy', String(state === 'loading'));
    focusTarget = node('p', text, root, 'pgd-note');
    focusTarget.tabIndex = -1;
  }
  function active(ticket) {
    return !disposed && !ctx.signal.aborted && ticket === generation;
  }
  function section(title, parent) {
    const el = node('section', undefined, parent, 'pgd-section');
    node('h4', title, el);
    return el;
  }
  const clean = (text) => (typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '');

  function media(record, parent, ticket) {
    const photo = record.photo;
    const box = node('div', undefined, parent, 'pgd-media');
    const unavailable = () => {
      const heldFocus = box.contains(doc.activeElement);
      box.replaceChildren();
      const note = node('p', 'Image unavailable.', box, 'pgd-unavailable');
      // Only recover focus when a failed image removes the focused trigger.
      if (heldFocus) {
        note.tabIndex = -1;
        note.focus();
      }
    };
    let src = null;
    if (photo && typeof photo[0] === 'string') {
      const resolved = ctx.media.resolve(photo[0]);
      if (typeof resolved === 'string' && resolved.trim()) {
        const url = new URL(resolved, doc.baseURI);
        if (url.origin === new URL(doc.baseURI).origin && /^https?:$/.test(url.protocol)) {
          src = url.href;
        }
      }
    }
    if (src) {
      const button = node('button', undefined, box, 'pgd-photo');
      button.type = 'button';
      button.setAttribute('aria-label', `Enlarge photo of ${record.name}`);
      const img = node('img', undefined, button);
      img.alt = '';
      img.decoding = 'async';
      listen(img, 'error', () => {
        if (active(ticket)) unavailable();
      });
      img.src = src;
      let opening = false;
      listen(button, 'click', async () => {
        if (opening) return;
        opening = true;
        box.querySelector('.pgd-photo-error')?.remove();
        try {
          await ctx.openPhoto(photo, { label: record.name, returnFocus: button });
        } catch {
          if (active(ticket)) {
            const text = 'The photo could not open. Try again.';
            let note = box.querySelector('.pgd-photo-error');
            if (!note) note = node('p', text, box, 'pgd-photo-error');
            ctx.announce(text);
          }
        } finally {
          opening = false;
        }
      });
    } else unavailable();

    if (!photo) return;
    // Retain the recorded attribution even when the image is unavailable.
    const credit = `Photo: ${clean(photo[2]) || 'Author not recorded'} · ${clean(photo[1]) || 'licence not recorded'}`;
    const caption = node('p', undefined, parent, 'pgd-credit');
    let href = null;
    if (typeof photo[3] === 'string' && /^https:\/\//i.test(photo[3])) {
      try {
        const url = new URL(photo[3]);
        if (url.protocol === 'https:' && !url.username && !url.password) href = url.href;
      } catch {
        // Malformed sources remain text, never an executable URL.
      }
    }
    if (href) {
      const link = node('a', credit, caption);
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = "The image's source page (opens in a new tab)";
      link.setAttribute('aria-label', `${credit}. Source page (opens in a new tab)`);
    } else {
      caption.textContent = credit;
      if (clean(photo[3])) node('span', `Source: ${clean(photo[3])}`, caption, 'pgd-source');
    }
  }

  function render(record, ticket) {
    clearView();
    root.dataset.state = 'ready';
    root.setAttribute('aria-busy', 'false');
    const header = node('header', undefined, root, 'pgd-header');
    focusTarget = node('h2', record.name, header);
    focusTarget.tabIndex = -1;
    if (record.place) {
      const place = [record.place.label, record.place.region].filter(Boolean).join(', ');
      if (place) node('p', place, header, 'pgd-place');
    }
    media(record, header, ticket);
    const background = node('section', undefined, root, 'pgd-background');
    node('h3', 'Background', background);
    node(
      'p',
      record.description || 'The catalog has no description for this genre.',
      section('About', background)
    );
    if (record.lineage) node('p', record.lineage, section('Lineage', background));
    const classification = section('Classification', background);
    node(
      'p',
      'Where the catalog files this genre by musical practice. Classification is not a claim of historical descent.',
      classification,
      'pgd-note'
    );
    if (record.path.length) {
      node('p', record.path.map((part) => part.name).join(' › '), classification, 'pgd-path');
    }
    const recordings = section('Recordings & references', background);
    const exemplars = record.exemplars.filter((x) => typeof x === 'string' && x.trim());
    node(
      'p',
      exemplars.length
        ? 'Artists the catalog names as exemplars. Listen opens a YouTube search; the catalog does not cite individual recordings.'
        : 'The catalog names no exemplar artists for this genre. Listen opens a YouTube search for the genre itself.',
      recordings,
      'pgd-note'
    );
    node(
      'p',
      'In this prototype, Listen entries are plain text; YouTube searches are unavailable.',
      recordings,
      'pgd-note'
    );
    if (exemplars.length) {
      const list = node('ul', undefined, recordings, 'pgd-exemplars');
      for (const name of exemplars) {
        const item = node('li', undefined, list);
        node('span', name, item);
        node('span', `Listen: ${name}`, item, 'pgd-listen');
      }
    } else node('p', `Listen: ${record.name}`, recordings, 'pgd-listen');
    if (record.status) node('p', `Catalog status: ${record.status}.`, recordings, 'pgd-status');
  }

  async function select(retry = false) {
    const ticket = ++generation;
    pending?.abort();
    pending = null;
    if (disposed || ctx.signal.aborted) return;
    const id = ctx.genre.current();
    if (id === null) {
      message(
        'No genre is open. Genre selection is not connected to Browse in this prototype yet.',
        'empty'
      );
      return;
    }
    const controller = new AbortController();
    pending = controller;
    message('Loading genre details…', 'loading');
    // Retry removes its initiating button; give that user a stable loading target.
    if (retry) focusTarget.focus();
    try {
      const record = await ctx.loadGenre(id, { signal: controller.signal });
      if (!active(ticket) || controller.signal.aborted) return;
      const carryFocus = retry && doc.activeElement === focusTarget;
      render(record, ticket);
      if (carryFocus) focusTarget.focus();
    } catch (error) {
      if (!active(ticket) || controller.signal.aborted) return;
      const carryFocus = retry && doc.activeElement === focusTarget;
      if (error?.name === 'AbortError') {
        message('Waiting for genre details was canceled. Try again.', 'canceled');
      } else {
        const known = error?.code === 'NOT_FOUND' || error?.code === 'LOAD_FAILED';
        message(
          known && typeof error.message === 'string' && error.message.trim()
            ? error.message
            : 'Genre details could not load. Check your connection, then try again.',
          'error'
        );
      }
      const text = focusTarget.textContent;
      if (error?.code !== 'NOT_FOUND') {
        const button = node('button', 'Retry', root, 'pgd-retry');
        button.type = 'button';
        button.setAttribute('aria-label', 'Retry loading genre details');
        listen(button, 'click', () => select(true));
        if (carryFocus) button.focus();
      } else if (carryFocus) focusTarget.focus();
      ctx.announce(text);
    } finally {
      if (ticket === generation) pending = null;
    }
  }

  function unmount() {
    if (disposed) return;
    disposed = true;
    generation++;
    pending?.abort();
    view?.abort();
    life.abort();
    unsubscribe?.();
    root.remove();
    stylesheet.remove();
  }
  const handle = Object.freeze({
    unmount,
    focus() {
      if (!disposed) focusTarget?.focus();
    },
  });
  if (ctx.signal.aborted) {
    unmount();
    return handle;
  }
  host.append(stylesheet, root);
  ctx.signal.addEventListener('abort', unmount, { once: true, signal: life.signal });
  unsubscribe = ctx.genre.subscribe(() => select());
  select();
  return handle;
}

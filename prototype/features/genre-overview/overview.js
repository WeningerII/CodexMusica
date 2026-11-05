// Production: src/pages/genre.js gpOverview. Contract: #668 6646665459.
// Shell owns selection, canonical glyphs/words, and all navigation. Branch/map
// callbacks currently announce unavailable; this lane never simulates success.
export function mount(host, ctx) {
  const doc = host.ownerDocument;
  let disposed = false;
  let generation = 0;
  let request = null;
  let unsubscribe = () => {};
  const style = doc.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./overview.css', import.meta.url).href;
  const root = doc.createElement('section');
  root.className = 'go-overview';
  root.setAttribute('aria-label', 'Overview');
  const heading = doc.createElement('h2');
  heading.textContent = 'Overview';
  heading.tabIndex = -1;
  const body = doc.createElement('div');
  root.append(heading, body);

  function node(tag, text, className) {
    const el = doc.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function button(label, action) {
    const el = node('button', label);
    el.type = 'button';
    el.addEventListener('click', () => {
      if (!disposed) action();
    });
    return el;
  }
  function tab(label, key) {
    return button(label, () => ctx.openGenreTab(key));
  }
  function note(text) {
    const el = node('p', text, 'go-note');
    el.tabIndex = -1;
    el.setAttribute('role', 'status');
    body.replaceChildren(el);
    return el;
  }
  function render(record) {
    const grid = node('div', undefined, 'go-grid');
    const ensemble = node('section');
    ensemble.append(node('h3', 'Ensemble'));
    const list = node('ul', undefined, 'go-ensemble');
    const shown = record.instruments.slice(0, 6);
    for (const instrument of shown) {
      const item = node('li');
      // The bridge supplies production image() as a data SVG. Never inject SVG
      // markup, accept script URLs, or fetch a remote image from a lane.
      if (
        typeof instrument.glyphUrl === 'string' &&
        /^data:image\/svg\+xml[,;]/i.test(instrument.glyphUrl)
      ) {
        const img = node('img');
        img.src = instrument.glyphUrl;
        img.alt = '';
        img.width = img.height = 28;
        item.append(img);
      }
      item.append(node('span', instrument.name || instrument.id));
      list.append(item);
    }
    if (record.instruments.length > shown.length) {
      list.append(node('li', `+${record.instruments.length - shown.length} more`, 'go-more'));
    }
    ensemble.append(list, tab('Inspect instruments', 'instruments'));
    const sound = node('section');
    sound.append(node('h3', 'Sound'));
    if (record.soundWords.length) {
      const words = node('ul', undefined, 'go-words');
      for (const word of record.soundWords) words.append(node('li', word));
      sound.append(words);
    } else {
      sound.append(
        node('p', 'The catalog places this genre in the middle of every characteristic.', 'go-note')
      );
    }
    sound.append(tab('Sound profile', 'sound'));
    if (record.crossListings.length) {
      const cross = node('p', undefined, 'go-also');
      cross.append(node('span', 'Also listed under: '));
      record.crossListings.forEach((listing, index) => {
        if (index) {
          const separator = node('span', ' · ');
          separator.setAttribute('aria-hidden', 'true');
          cross.append(separator);
        }
        cross.append(button(listing.name, () => ctx.openGenreBranch(listing.id)));
      });
      sound.append(cross);
    }
    sound.append(tab('Recordings & references', 'background'));
    grid.append(ensemble, sound);
    const footer = node('div', undefined, 'go-footer');
    footer.append(
      tab('Find similar sounds', 'similar'),
      button('View on map', () => ctx.openGenreMap(record.id))
    );
    body.replaceChildren(grid, footer);
  }
  async function load(again = false) {
    if (disposed) return;
    const ticket = ++generation;
    request?.abort();
    request = null;
    const id = ctx.genre.current();
    if (!id) {
      note('Open a genre to see its overview.');
      return;
    }
    const controller = new AbortController();
    request = controller;
    const loading = note('Loading the overview…');
    if (again) loading.focus();
    const current = () => !disposed && ticket === generation && !controller.signal.aborted;
    try {
      const record = await ctx.loadGenreOverview(id, { signal: controller.signal });
      if (!current()) return;
      const follows = again && doc.activeElement === loading;
      render(record); // A retired requested id can legitimately resolve to a live id.
      if (follows) heading.focus();
    } catch (error) {
      if (!current() || error?.name === 'AbortError') return;
      const follows = again && doc.activeElement === loading;
      const message =
        ['NOT_FOUND', 'LOAD_FAILED'].includes(error?.code) && typeof error.message === 'string'
          ? error.message
          : 'This genre’s details couldn’t load. Check your connection, then try again.';
      note(message);
      const retry = button('Retry', () => load(true));
      retry.setAttribute('aria-label', 'Retry loading the overview');
      body.append(retry);
      if (follows) retry.focus();
    }
  }
  function unmount() {
    if (disposed) return;
    disposed = true;
    generation++;
    request?.abort();
    unsubscribe();
    ctx.signal.removeEventListener('abort', unmount);
    style.remove();
    root.remove();
  }
  const handle = {
    unmount,
    focus: () => {
      if (!disposed) heading.focus();
    },
  };
  if (ctx.signal.aborted) {
    disposed = true;
    return handle;
  }
  host.append(style, root);
  ctx.signal.addEventListener('abort', unmount, { once: true });
  unsubscribe = ctx.genre.subscribe(() => load());
  load();
  return handle;
}

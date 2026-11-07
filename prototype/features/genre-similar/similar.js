// #670 / #668 6647387849: only the host ranks, resolves aliases and edits recipes.
const INTRO =
  'Nearest genres across the 13 sound characteristics. Each row names the characteristics where the two agree most closely; it is a comparison of sound, not of history.';
const EMPTY = 'The catalog has no sound characteristics for this genre, so it has no neighbours.';

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const style = doc.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./similar.css', import.meta.url).href;
  const root = doc.createElement('section');
  root.className = 'genre-similar';
  const title = doc.createElement('h2');
  title.textContent = 'Similar sounds';
  title.tabIndex = -1;
  const body = doc.createElement('div');
  root.append(title, body);
  host.append(style, root);
  let dead = false;
  let generation = 0;
  let request = null;
  let stop = () => {};
  const element = (tag, text, cls) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const button = (text, action) => {
    const node = element('button', text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  };
  const current = (version) => !dead && version === generation && !ctx.signal.aborted;
  function show(record, version) {
    title.textContent = `Similar sounds to ${record.name}`;
    body.replaceChildren();
    if (!record.neighbours.length) {
      body.append(element('p', EMPTY));
      return;
    }
    body.append(element('p', INTRO));
    const list = element('ul', undefined, 'genre-similar-list');
    for (const neighbour of record.neighbours) {
      const row = element('li', undefined, 'genre-similar-row');
      row.dataset.genreId = neighbour.id;
      const open = button('', () => {
        if (current(version)) ctx.openGenre(neighbour.id);
      });
      open.className = 'genre-similar-open';
      for (const glyph of neighbour.glyphs) {
        const img = element('img');
        img.src = glyph.url;
        img.alt = '';
        img.title = glyph.label;
        img.width = img.height = 24;
        open.append(img);
      }
      open.append(element('span', neighbour.name));
      const agreement = element('p', neighbour.agreements.join(' · '), 'genre-similar-agreement');
      const listen = element('a', 'Listen');
      listen.href = neighbour.listenHref;
      listen.target = '_blank';
      listen.rel = 'noopener noreferrer';
      listen.setAttribute('aria-label', `Listen to ${neighbour.name} on YouTube`);
      const add = button('Add', () => {
        if (current(version)) ctx.addGenre(neighbour.id);
      });
      add.setAttribute('aria-label', `Add ${neighbour.name} to Your recipe`);
      row.append(open, agreement, listen, add);
      list.append(row);
    }
    body.append(
      list,
      button('Find more like this', () => {
        if (current(version)) ctx.useSoundTargets(record.id);
      })
    );
  }
  async function refresh(retry = false) {
    if (dead || ctx.signal.aborted) return;
    const version = ++generation;
    request?.abort();
    request = new AbortController();
    const id = ctx.genre.current();
    title.textContent = 'Similar sounds';
    body.removeAttribute('aria-busy');
    if (!id) {
      body.replaceChildren(element('p', 'Choose a genre to see similar sounds.'));
      return;
    }
    const loading = element('p', 'Loading similar sounds…');
    loading.tabIndex = -1;
    body.replaceChildren(loading);
    body.setAttribute('aria-busy', 'true');
    if (retry) loading.focus();
    try {
      const record = await ctx.loadGenreSimilar(id, { signal: request.signal });
      if (!current(version)) return;
      body.removeAttribute('aria-busy');
      show(record, version);
      if (retry) title.focus();
    } catch (error) {
      if (!current(version) || error?.name === 'AbortError') return;
      body.removeAttribute('aria-busy');
      const missing = error?.code === 'NOT_FOUND';
      const message = missing
        ? 'This genre isn’t in the catalog’s data. Reload to see the current catalog.'
        : 'This genre’s similar sounds couldn’t load. Check your connection, then try again.';
      const again = button('Retry', () => {
        if (current(version)) refresh(true);
      });
      body.replaceChildren(element('p', message), again);
      ctx.announce(message);
      if (retry) again.focus();
    }
  }
  function unmount() {
    if (dead) return;
    dead = true;
    generation++;
    request?.abort();
    stop();
    ctx.signal.removeEventListener('abort', unmount);
    root.remove();
    style.remove();
  }
  if (ctx.signal.aborted) unmount();
  else {
    stop = ctx.genre.subscribe(() => refresh());
    ctx.signal.addEventListener('abort', unmount, { once: true });
    refresh();
  }
  return {
    unmount,
    focus() {
      if (!dead) title.focus();
    },
  };
}

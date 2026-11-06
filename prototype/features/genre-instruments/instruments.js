// #670 rows 172/173, partial 170/88. Contract: #668 comment 6647387849.
// The host alone configures cards, writes recipes, announces outcomes and routes.
let serial = 0;

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const root = doc.createElement('section');
  root.className = 'gi-panel';
  root.setAttribute('aria-label', 'Genre instruments');
  const style = doc.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./instruments.css', import.meta.url).href;
  root.append(style);
  const body = doc.createElement('div');
  root.append(body);
  host.append(root);
  const prefix = `gi-${++serial}`;
  let alive = true;
  let generation = 0;
  let controller;
  let timer;
  let removedDestination = false;
  let record = null;
  let select;
  let note;
  let footer;
  let adds = [];
  let pending = false;
  let snapshot = ctx.recipe.snapshot();
  const stored = ctx.storage.read('destinations');
  const destinations = new Map(
    stored.ok && stored.value && typeof stored.value === 'object'
      ? Object.entries(stored.value).filter(([, v]) => v === null || typeof v === 'string')
      : []
  );

  function node(tag, text, className) {
    const el = doc.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function save() {
    ctx.storage.write('destinations', Object.fromEntries(destinations));
  }
  function chosen() {
    return destinations.has(record.id) ? destinations.get(record.id) : record.id;
  }
  function destinationNote(removed = false) {
    if (snapshot.status !== 'ready') return 'Waiting for recipe destinations…';
    const dest = chosen();
    const group = snapshot.groups.find((g) => g.genreId === dest);
    const name = dest === record.id ? record.name : group?.name;
    return (
      (removed ? 'The previous destination is no longer in Your recipe. ' : '') +
      (dest === null
        ? 'Added on its own, outside any genre group.'
        : `Joins the ${name} group in Your recipe${group?.count ? '' : ' (the group is created)'}.`)
    );
  }
  function updateRecipe(delayed = false) {
    if (!alive || !record) return;
    let removed = false;
    const dest = chosen();
    // Do not discard a saved choice while the recipe is still loading.
    if (
      snapshot.status === 'ready' &&
      dest !== null &&
      dest !== record.id &&
      !snapshot.groups.some((g) => g.genreId === dest)
    ) {
      destinations.set(record.id, record.id);
      save();
      removed = true;
    }
    const target = chosen();
    const options = [
      { genreId: record.id, name: record.name },
      ...snapshot.groups.filter((g) => g.genreId !== record.id),
    ];
    select.replaceChildren();
    for (const g of options) {
      const option = node(
        'option',
        `${g.name} — set up as ${g.genreId === record.id ? record.name : 'that genre'} plays it`
      );
      option.value = g.genreId;
      select.append(option);
    }
    if (target !== null && !options.some((g) => g.genreId === target)) {
      const waiting = node('option', 'Saved destination — waiting for recipe');
      waiting.value = target;
      select.append(waiting);
    }
    const independent = node('option', 'Independent instrument — default settings');
    independent.value = '';
    select.append(independent);
    select.value = target ?? '';
    const unavailable = pending || snapshot.busy || snapshot.status !== 'ready';
    select.disabled = unavailable;
    const destName =
      target === record.id ? record.name : snapshot.groups.find((g) => g.genreId === target)?.name;
    for (const { button, instrument } of adds) {
      button.setAttribute(
        'aria-label',
        target === null
          ? `Add ${instrument.name} on its own`
          : destName
            ? `Add ${instrument.name} to ${destName}`
            : `Add ${instrument.name}`
      );
      // aria-disabled retains focus on the pressed button during host updates.
      button.setAttribute('aria-disabled', String(unavailable));
    }
    footer.setAttribute('aria-disabled', String(unavailable));
    footer.textContent = snapshot.groups.some((g) => g.genreId === record.id && g.count > 0)
      ? 'Add the whole ensemble again'
      : 'Add the whole ensemble';
    if (removed) removedDestination = true;
    if (delayed || removed) {
      clearTimeout(timer);
      const version = generation;
      timer = setTimeout(() => {
        timer = undefined;
        if (alive && generation === version) {
          note.textContent = destinationNote(removedDestination);
          removedDestination = false;
        }
      }, 300);
    } else if (timer === undefined) note.textContent = destinationNote();
  }
  async function add(instrumentId) {
    if (!alive || !record || pending || snapshot.busy || snapshot.status !== 'ready') return;
    const revision = snapshot.revision;
    const genreId = record.id;
    const destination = chosen();
    pending = true;
    updateRecipe();
    try {
      // No optimistic mutation or inferred success. In particular, 'independent'
      // can be the actual result of a requested grouped addition. The shell says so.
      if (instrumentId) {
        await ctx.recipe.addInstrument({ instrumentId, destination, revision });
      } else await ctx.recipe.addEnsemble({ genreId, revision });
    } catch {
      // Includes STALE/BUSY: the shell owns failure announcements and retry policy.
    } finally {
      pending = false;
      if (alive) {
        snapshot = ctx.recipe.snapshot();
        updateRecipe();
      }
    }
  }
  function render() {
    const version = generation;
    const current = () => alive && version === generation;
    body.replaceChildren();
    const heading = node('h2', 'Instruments');
    heading.tabIndex = -1;
    body.append(heading);
    const label = node('label', 'Add single instruments to');
    select = node('select');
    select.id = `${prefix}-destination`;
    label.htmlFor = select.id;
    note = node('p', '', 'gi-note');
    note.id = `${prefix}-note`;
    note.setAttribute('aria-live', 'polite');
    select.setAttribute('aria-describedby', note.id);
    select.addEventListener('change', () => {
      if (!current()) return;
      removedDestination = false;
      destinations.set(record.id, select.value || null);
      save();
      updateRecipe(true);
    });
    body.append(label, select, note);
    const list = node('ul', undefined, 'gi-roster');
    adds = [];
    for (const instrument of record.instruments) {
      const row = node('li', undefined, 'gi-row');
      if (instrument.glyphUrl) {
        const glyph = node('img');
        glyph.src = instrument.glyphUrl;
        glyph.alt = '';
        glyph.width = glyph.height = 30;
        row.append(glyph);
      }
      const inspect = node('button', instrument.name, 'gi-inspect');
      inspect.type = 'button';
      inspect.setAttribute('aria-label', `Inspect ${instrument.name} on the Instrument page`);
      inspect.addEventListener('click', () => {
        if (!current()) return;
        ctx.openInstrument(instrument.id, { returnFocus: inspect });
      });
      row.append(inspect);
      if (instrument.listenHref) {
        const listen = node('a', 'Listen');
        listen.href = instrument.listenHref;
        listen.target = '_blank';
        listen.rel = 'noopener noreferrer';
        listen.setAttribute('aria-label', `Listen to ${instrument.name} on YouTube`);
        row.append(listen);
      } else row.append(node('span', 'Listen unavailable', 'gi-unavailable'));
      const button = node('button', 'Add', 'gi-add');
      button.type = 'button';
      button.addEventListener('click', () => current() && add(instrument.id));
      row.append(button);
      adds.push({ button, instrument });
      list.append(row);
    }
    body.append(list);
    if (!record.instruments.length) body.append(node('p', 'No instruments listed for this genre.'));
    footer = node('button', '', 'gi-ensemble');
    footer.type = 'button';
    footer.setAttribute(
      'aria-label',
      `Add the whole ${record.name} ensemble (${record.instruments.length} instruments)`
    );
    footer.addEventListener('click', () => current() && add());
    body.append(footer);
    updateRecipe();
  }
  async function load() {
    if (!alive) return;
    const version = ++generation;
    controller?.abort();
    controller = new AbortController();
    clearTimeout(timer);
    timer = undefined;
    removedDestination = false;
    record = null;
    body.replaceChildren();
    const id = ctx.genre.current();
    if (!id) {
      body.append(node('p', 'Choose a genre to inspect its instruments.'));
      return;
    }
    body.append(node('p', 'Loading instruments…'));
    try {
      const value = await ctx.loadGenreInstruments(id, { signal: controller.signal });
      if (!alive || version !== generation) return;
      record = value;
      snapshot = ctx.recipe.snapshot();
      render();
    } catch (error) {
      if (!alive || version !== generation) return;
      body.replaceChildren(node('p', error.message || 'Could not load instruments.'));
      const retry = node('button', 'Try again');
      retry.type = 'button';
      retry.addEventListener('click', () => {
        if (alive && version === generation) load();
      });
      body.append(retry);
    }
  }
  const unsubscribeGenre = ctx.genre.subscribe(load);
  const unsubscribeRecipe = ctx.recipe.subscribe(() => {
    if (!alive) return;
    snapshot = ctx.recipe.snapshot();
    updateRecipe();
  });
  load();
  return () => {
    alive = false;
    ++generation;
    controller?.abort();
    clearTimeout(timer);
    unsubscribeGenre();
    unsubscribeRecipe();
    root.remove();
  };
}

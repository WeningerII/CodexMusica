// #668 6665493327: category data/navigation belong to the shell.
// Discovery seam: #668 6665819883, inclusive host breakpoint corrected in 6665885557.
export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const stylesheet = doc.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./categories.css', import.meta.url).href;
  const root = doc.createElement('section');
  root.className = 'pgc';
  root.setAttribute('aria-label', 'Genre categories');
  const content = doc.createElement('nav');
  content.id = 'genre-categories-more';
  content.tabIndex = -1;
  content.setAttribute('aria-label', 'Genre categories');
  const disclosure = doc.createElement('button');
  disclosure.type = 'button';
  disclosure.className = 'pgc-button';
  disclosure.setAttribute('data-discovery-toggle', '');
  disclosure.setAttribute('aria-controls', content.id + ' proto-genre-targets');
  const message = doc.createElement('p');
  message.className = 'pgc-message';
  root.append(disclosure, content, message);
  host.append(stylesheet, root);
  let stopped = false,
    pending = false,
    ticket = 0;
  let commandError = '',
    discoveryError = '',
    discoveryPending = false;
  const unsubscribers = [];
  const node = (tag, text, className) => {
    const element = doc.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const keyOf = (element) => element?.closest?.('[data-category-action]')?.dataset;
  const find = (action, id = '') =>
    [...content.querySelectorAll('[data-category-action]')].find(
      (b) => b.dataset.categoryAction === action && b.dataset.categoryId === id
    );
  const focus = (element) => {
    if (element && !element.disabled && element.isConnected && !element.closest('[hidden]')) {
      element.focus({ preventScroll: true });
    }
  };
  function renderMessage() {
    message.textContent = discoveryError || commandError;
    message.hidden = !message.textContent;
  }
  function syncDisclosure() {
    if (stopped) return;
    const state = ctx.discovery.current();
    const active = doc.activeElement;
    const wasInList = content.contains(active);
    const wasToggle = active === disclosure;
    const branch = ctx.categories.current().branch?.node.name;
    const applied = ctx.targets.current().applied;
    const labels = [branch, applied ? applied + ' target' + (applied === 1 ? '' : 's') : ''].filter(
      Boolean
    );
    disclosure.textContent =
      'Categories & find a sound' + (labels.length ? ' (' + labels.join(', ') + ')' : '');
    disclosure.hidden = !state.narrow;
    disclosure.setAttribute('aria-expanded', String(state.open));
    disclosure.setAttribute('aria-disabled', String(discoveryPending));
    content.hidden = state.narrow && !state.open;
    if (content.hidden && wasInList) focus(disclosure);
    else if (disclosure.hidden && wasToggle)
      focus(content.querySelector('button:not(:disabled)') || content);
  }
  async function toggleDiscovery() {
    if (stopped || discoveryPending) return;
    const state = ctx.discovery.current();
    discoveryPending = true;
    discoveryError = '';
    syncDisclosure();
    renderMessage();
    try {
      await ctx.discovery.setOpen(!state.open, state.revision);
    } catch (error) {
      if (stopped) return;
      discoveryError =
        error?.code === 'STALE'
          ? 'Discovery changed. Please try again.'
          : 'The categories could not be opened or closed. Please try again.';
    } finally {
      if (!stopped) {
        discoveryPending = false;
        syncDisclosure();
        renderMessage();
      }
    }
  }
  function glyphs(record) {
    const span = node('span', undefined, 'pgc-glyphs');
    span.setAttribute('aria-hidden', 'true');
    for (const glyph of record.glyphs) {
      const img = doc.createElement('img');
      img.src = glyph.url;
      img.alt = '';
      img.title = glyph.label;
      img.width = img.height = 22;
      span.append(img);
    }
    return span;
  }
  function button(action, label, id = '') {
    const b = node('button', label, 'pgc-button');
    b.type = 'button';
    b.dataset.categoryAction = action;
    b.dataset.categoryId = id;
    b.disabled = pending;
    return b;
  }
  function branchButton(record) {
    const b = button('branch', '', record.id);
    b.append(
      glyphs(record),
      node('span', record.name, 'pgc-name'),
      node('span', record.count.toLocaleString(), 'pgc-count')
    );
    return b;
  }
  function list(records) {
    const ul = node('ul', undefined, 'pgc-list');
    for (const record of records) {
      const li = node('li');
      li.append(branchButton(record));
      ul.append(li);
    }
    return ul;
  }
  function render() {
    if (stopped) return;
    const active = doc.activeElement;
    const hadFocus = content.contains(active);
    const key = hadFocus ? keyOf(active) : null;
    const snapshot = ctx.categories.current();
    content.replaceChildren();
    if (snapshot.status === 'loading') content.append(node('p', 'Loading categories…'));
    else if (snapshot.status === 'error') {
      content.append(node('p', snapshot.error?.message || 'Categories could not load.'));
    } else if (snapshot.status === 'ready') {
      if (snapshot.branch) {
        const { node: current, parent, cross, children } = snapshot.branch;
        content.append(button('back', 'Back to ' + (parent?.name || 'all genres')));
        const heading = node('div', undefined, 'pgc-current');
        heading.append(
          glyphs(current),
          node('strong', current.name),
          node('span', current.count.toLocaleString(), 'pgc-count')
        );
        content.append(heading);
        if (cross)
          content.append(
            node('p', 'Includes ' + cross.toLocaleString() + ' cross-listed from other branches.')
          );
        if (children.length) content.append(list(children));
      } else {
        const all = button('all', '');
        all.append(
          node('span', 'All genres'),
          node('span', snapshot.total.toLocaleString(), 'pgc-count')
        );
        content.append(all, list(snapshot.allRoots ? snapshot.roots : snapshot.roots.slice(0, 10)));
        if (snapshot.rootCount > 10) {
          const toggle = button(
            'roots',
            snapshot.allRoots ? 'Fewer categories' : 'All ' + snapshot.rootCount + ' categories'
          );
          toggle.setAttribute('aria-expanded', String(snapshot.allRoots));
          content.append(toggle);
        }
      }
    }
    syncDisclosure();
    renderMessage();
    if (key && hadFocus) focus(find(key.categoryAction, key.categoryId));
  }
  async function command(action, id) {
    if (pending || stopped || ctx.categories.current().status !== 'ready') return;
    const revision = ctx.categories.current().revision;
    pending = true;
    commandError = '';
    const request = ++ticket;
    render();
    try {
      let result;
      if (action === 'branch') result = await ctx.categories.openBranch(id, revision);
      else if (action === 'back') result = await ctx.categories.back(revision);
      else if (action === 'all') result = await ctx.categories.allGenres(revision);
      else if (action === 'roots') result = await ctx.categories.toggleRoots(revision);
      if (stopped || request !== ticket) return;
      pending = false;
      render();
      if (result?.revision !== ctx.categories.current().revision) return;
      if (doc.activeElement !== doc.body && !root.contains(doc.activeElement)) return;
      if (action === 'back') focus(find(ctx.categories.current().branch ? 'back' : 'all'));
      if (action === 'roots') focus(find('roots'));
      if (action === 'all') focus(find('all'));
    } catch (error) {
      if (stopped || request !== ticket) return;
      pending = false;
      commandError =
        error?.code === 'STALE'
          ? 'Categories changed. Please try again.'
          : error?.code === 'BUSY'
            ? 'Another change is in progress. Please try again.'
            : error?.code === 'NOT_FOUND'
              ? 'That category is no longer available.'
              : 'The category could not be changed. Please try again.';
      render();
      if (doc.activeElement === doc.body || root.contains(doc.activeElement)) {
        focus(find(action, id));
      }
    }
  }
  function onClick(event) {
    const b = event.target.closest('[data-category-action]');
    if (!b || !content.contains(b) || b.disabled) return;
    void command(b.dataset.categoryAction, b.dataset.categoryId);
  }
  function unmount() {
    if (stopped) return;
    stopped = true;
    ticket++;
    for (const unsubscribe of unsubscribers) unsubscribe();
    disclosure.removeEventListener('click', toggleDiscovery);
    content.removeEventListener('click', onClick);
    ctx.signal.removeEventListener('abort', unmount);
    stylesheet.remove();
    root.remove();
  }
  if (ctx.signal.aborted) {
    unmount();
    return { unmount, focus() {} };
  }
  content.addEventListener('click', onClick);
  disclosure.addEventListener('click', toggleDiscovery);
  unsubscribers.push(ctx.categories.subscribe(render));
  unsubscribers.push(ctx.discovery.subscribe(syncDisclosure));
  unsubscribers.push(ctx.targets.subscribe(syncDisclosure));
  ctx.signal.addEventListener('abort', unmount, { once: true });
  render();
  return {
    unmount,
    focus: () =>
      focus(
        disclosure.hidden ? content.querySelector('button:not(:disabled)') || content : disclosure
      ),
  };
}

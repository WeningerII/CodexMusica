// #670 Sound profile only. Data and navigation belong to the shell (#755).
// useSoundTargets is currently an announcing stand-in, not a completed workflow.
const MESSAGES = {
  NOT_FOUND: 'This genre isn’t in the catalog’s data. Reload to see the current catalog.',
  LOAD_FAILED: 'This genre’s details couldn’t load. Check your connection, then try again.',
};

// Production src/app.js axisLabel: keep the thresholds and wording intact.
function axisLabel(axis, value) {
  if (value <= -1.5) return axis.neg;
  if (value <= -0.5) return 'leans ' + axis.neg;
  if (value < 0.5 && value > -0.5) return 'middle';
  if (value < 1.5) return 'leans ' + axis.pos;
  return axis.pos;
}

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const element = (tag, className, text) => {
    const node = doc.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const sheet = element('link', 'genre-sound-sheet');
  sheet.rel = 'stylesheet';
  sheet.href = new URL('./sound.css', import.meta.url).href;
  const root = element('section', 'genre-sound');
  root.setAttribute('aria-label', 'Sound profile');
  const heading = element('h2', 'genre-sound-heading', 'Sound profile');
  heading.tabIndex = -1;
  const content = element('div', 'genre-sound-content');
  root.append(heading, content);
  let disposed = false;
  let generation = 0;
  let pending = null;
  let unsubscribe = () => {};
  const events = new AbortController();

  const focus = () => {
    if (!disposed) heading.focus();
  };
  const button = (text, action) => {
    const node = element('button', 'genre-sound-button', text);
    node.type = 'button';
    node.addEventListener('click', action, { signal: events.signal });
    return node;
  };
  const note = (text) => {
    const p = element('p', 'genre-sound-note', text);
    p.tabIndex = -1;
    content.replaceChildren(p);
    return p;
  };

  function render(profile) {
    const intro = element(
      'p',
      'genre-sound-note',
      `Where the catalog places ${profile.name} on each of the 13 sound characteristics, from −2 to +2. The same values drive Similar sounds and Find a sound.`
    );
    const list = element('ul', 'genre-sound-profile');
    profile.definitions.forEach((axis, i) => {
      const { value, recorded } = profile.axes[i];
      const row = element('li', 'genre-sound-row');
      row.dataset.axis = axis.id;
      row.dataset.recorded = String(recorded);
      const label = axisLabel(axis, value);
      const scale = element('span', 'genre-sound-scale');
      scale.setAttribute('role', 'img');
      scale.setAttribute(
        'aria-label',
        `${axis.name}: ${label} (${value > 0 ? '+' : ''}${value} from −2 ${axis.neg} to +2 ${axis.pos})`
      );
      const dots = element('span', 'genre-sound-dots');
      for (const step of [-2, -1, 0, 1, 2]) {
        dots.append(element('span', `genre-sound-dot${step === value ? ' is-on' : ''}`));
      }
      scale.append(
        element('span', 'genre-sound-end', axis.neg),
        dots,
        element('span', 'genre-sound-end', axis.pos)
      );
      row.append(
        element('span', 'genre-sound-name', axis.name),
        scale,
        element('span', 'genre-sound-value', label)
      );
      list.append(row);
    });
    const actions = element('div', 'genre-sound-actions');
    actions.append(
      button('Use as sound targets', () => ctx.useSoundTargets(profile.id)),
      button('Similar sounds', () => ctx.openGenreTab('similar'))
    );
    content.replaceChildren(intro, list);
    if (profile.axes.some((axis) => !axis.recorded)) {
      content.append(
        element(
          'p',
          'genre-sound-note',
          'Where the catalog has no value, this profile displays 0. That does not establish measured neutrality.'
        )
      );
    }
    content.append(actions);
  }

  async function refresh(retry = false) {
    if (disposed) return;
    const token = ++generation;
    if (pending) pending.abort();
    pending = null;
    const id = ctx.genre.current();
    const follow = retry || content.contains(doc.activeElement);
    if (!id) {
      root.removeAttribute('aria-busy');
      const empty = note('Open a genre to inspect its sound profile.');
      if (follow) empty.focus();
      return;
    }
    pending = new AbortController();
    root.setAttribute('aria-busy', 'true');
    const loading = note('Loading the sound profile…');
    if (follow) loading.focus();
    try {
      const profile = await ctx.loadSoundProfile(id, { signal: pending.signal });
      if (disposed || token !== generation) return;
      const moveFocus = doc.activeElement === loading;
      render(profile);
      if (moveFocus) focus();
    } catch (error) {
      if (disposed || token !== generation) return;
      const moveFocus = doc.activeElement === loading;
      const text =
        error?.name === 'AbortError'
          ? 'Loading the sound profile was cancelled. Try again.'
          : MESSAGES[error?.code]
            ? error.message || MESSAGES[error.code]
            : MESSAGES.LOAD_FAILED;
      note(text);
      const again = button('Retry', () => refresh(true));
      content.append(again);
      if (moveFocus) again.focus();
      ctx.announce(text);
    } finally {
      if (!disposed && token === generation) {
        pending = null;
        root.removeAttribute('aria-busy');
      }
    }
  }

  function unmount() {
    if (disposed) return;
    disposed = true;
    generation++;
    events.abort();
    if (pending) pending.abort();
    unsubscribe();
    ctx.signal.removeEventListener('abort', unmount);
    root.remove();
    sheet.remove();
  }

  if (ctx.signal.aborted) disposed = true;
  else {
    host.append(sheet, root);
    ctx.signal.addEventListener('abort', unmount, { once: true });
    unsubscribe = ctx.genre.subscribe(() => refresh());
    refresh();
  }
  return { focus, unmount };
}

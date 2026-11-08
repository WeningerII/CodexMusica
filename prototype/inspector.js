// Shell-owned selection/trail/close, distinct from the unavailable #760 lane.
// The preview store owns revisions and edits; this frame never writes cards.
export function createInspector({
  panel,
  selection,
  recipe,
  select,
  nameOf,
  announce,
  onClose = () => {},
}) {
  const doc = panel.ownerDocument;
  const root = doc.createElement('section');
  root.setAttribute('aria-label', 'Instrument preview');
  const heading = doc.createElement('h2');
  heading.tabIndex = -1;
  heading.id = 'proto-inspector-title';
  const back = doc.createElement('button');
  back.type = 'button';
  const close = doc.createElement('button');
  close.type = 'button';
  close.textContent = 'Close instrument preview';
  const body = doc.createElement('div');
  root.append(heading, back, close, body);
  panel.append(root);
  let trail = [];
  let opener = null;
  let ended = false;
  const life = new AbortController();
  const paint = () => {
    const id = selection.current();
    root.hidden = !id;
    heading.textContent = id ? nameOf(id) || id : 'Instrument preview';
    back.hidden = trail.length < 2;
    back.textContent =
      trail.length > 1 ? `Back to ${nameOf(trail.at(-2)) || trail.at(-2)}` : 'Back';
  };
  const refuse = (code, message) => {
    announce(message);
    throw Object.assign(new Error(message), { code });
  };
  const open = (id, { similar = false, fromInstrumentId, previewRevision, returnFocus } = {}) => {
    if (ended) throw Object.assign(new Error('Instrument preview ended.'), { code: 'ENDED' });
    if (
      similar &&
      (selection.current() !== fromInstrumentId ||
        !recipe.previewIs(fromInstrumentId, previewRevision))
    )
      return refuse('STALE', 'The instrument preview changed. Select the neighbour again.');
    if (typeof id !== 'string' || !nameOf(id))
      return refuse('NOT_FOUND', 'This instrument isn’t in the catalog’s data.');
    if (similar) {
      if (!trail.length) trail = [fromInstrumentId];
      if (trail.at(-1) !== id) trail.push(id);
    } else {
      trail = [id];
      opener = returnFocus || doc.activeElement;
    }
    select(id);
    paint();
    return { id };
  };
  const endPreview = () => {
    if (ended || !selection.current()) return;
    onClose();
    trail = [];
    selection.set(null);
    paint();
    const target =
      opener?.isConnected && !opener.closest('[hidden]')
        ? opener
        : panel.querySelector('.icatalog input[type="search"]');
    (target || panel.querySelector('h1'))?.focus();
  };
  close.addEventListener('click', endPreview, { signal: life.signal });
  root.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        event.stopPropagation();
        endPreview();
      }
    },
    { signal: life.signal }
  );
  back.addEventListener(
    'click',
    () => {
      if (trail.length < 2 || ended) return;
      trail.pop();
      select(trail.at(-1));
      paint();
      heading.focus();
    },
    { signal: life.signal }
  );
  const stop = selection.subscribe(paint);
  paint();
  return {
    root,
    body,
    open,
    focus: () => {
      if (!ended && !root.hidden) heading.focus();
    },
    unmount() {
      ended = true;
      life.abort();
      stop();
      root.remove();
    },
  };
}

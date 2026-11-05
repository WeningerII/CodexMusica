// #670 row 205. Contract: #668 comments 6646846068 and 6647373109.
// The host owns the preview,
// its format, and all rendering/clipboard operations; this lane owns only DOM.
const FORMATS = [
  ['rich', 'Rich'],
  ['tags', 'Tags'],
  ['prose', 'Prose'],
  ['compact', 'Compact'],
];

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const output = ctx.output;
  let disposed = false;
  let unsubscribe;
  let shown;
  const listeners = [];
  const root = doc.createElement('div');
  root.className = 'io-output';
  const state = doc.createElement('p');
  state.className = 'io-state';
  state.tabIndex = -1;
  const content = doc.createElement('div');
  content.className = 'io-content';
  const formats = doc.createElement('div');
  formats.className = 'io-formats';
  formats.setAttribute('role', 'group');
  formats.setAttribute('aria-label', 'Output format');
  const help = doc.createElement('p');
  help.className = 'io-help';
  help.textContent =
    "This instrument on its own, as it would be added. The whole recipe's output is in Your recipe's preview.";
  const pre = doc.createElement('pre');
  pre.className = 'io-text';
  const foot = doc.createElement('div');
  foot.className = 'io-foot';
  const count = doc.createElement('span');
  const copyButton = doc.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'io-copy';
  copyButton.textContent = 'Copy';
  function listen(node, type, handler) {
    node.addEventListener(type, handler);
    listeners.push(() => node.removeEventListener(type, handler));
  }

  function refresh() {
    if (disposed) return;
    const next = output.snapshot();
    shown = next;
    const ready = next.status === 'ready';
    const ownedFocus = content.contains(doc.activeElement);
    const stateFocused = doc.activeElement === state;
    content.hidden = !ready;
    state.hidden = ready;
    root.setAttribute('aria-busy', String(next.status === 'loading'));
    state.textContent = ready
      ? ''
      : next.status === 'error'
        ? next.error.message
        : 'Preparing instrument output…';
    for (const [id, button] of buttons) {
      button.disabled = !ready;
      button.setAttribute('aria-pressed', String(next.format === id));
    }
    copyButton.disabled = !ready;
    if (ready) {
      pre.setAttribute('aria-label', `${next.format} output`);
      pre.textContent = next.text || 'Nothing configured yet.';
      count.textContent = `${next.text.length.toLocaleString('en')} characters`;
      if (stateFocused) {
        buttons.find(([id]) => id === next.format)?.[1].focus({ preventScroll: true });
      }
    } else {
      // Clear stale text even though its container is hidden.
      pre.textContent = '';
      count.textContent = '';
      if (ownedFocus) state.focus({ preventScroll: true });
    }
  }

  // A queued input for a now-stale preview must not copy a different card.
  function currentReady() {
    if (disposed) return false;
    const previous = shown;
    refresh();
    return (
      shown.status === 'ready' &&
      previous.instrumentId === shown.instrumentId &&
      previous.revision === shown.revision &&
      previous.format === shown.format &&
      previous.text === shown.text
    );
  }

  const buttons = FORMATS.map(([id, label]) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.dataset.outputFormat = id;
    button.textContent = label;
    listen(button, 'click', () => {
      if (!currentReady()) return;
      output.setFormat(id); // Synchronous, undefined; never a revision-bearing action.
      refresh();
      // Stable nodes preserve keyboard focus without stealing it on notifications.
    });
    formats.append(button);
    return [id, button];
  });

  listen(copyButton, 'click', () => {
    if (!currentReady()) return;
    try {
      // Enter the host synchronously while the trusted click still has activation.
      // The host writes and announces exactly once (#668 6647373109).
      // Receipts never change lane DOM or focus, even after selection/teardown.
      const pending = output.copy();
      Promise.resolve(pending).catch(() => {});
    } catch {
      // The contract resolves {ok:false}; tolerate a broken host without a
      // second result or announcement. All outcome reporting belongs to it.
    }
  });

  foot.append(count, copyButton);
  content.append(formats, help, pre, foot);
  root.append(state, content);

  function unmount() {
    if (disposed) return;
    disposed = true;
    unsubscribe?.();
    for (const remove of listeners) remove();
    ctx.signal.removeEventListener('abort', unmount);
    root.remove();
  }

  const handle = {
    unmount,
    focus() {
      if (disposed) return;
      refresh();
      const selected = buttons.find(([id]) => id === shown.format)?.[1];
      (shown.status === 'ready' ? selected : state)?.focus({ preventScroll: true });
    },
  };
  if (ctx.signal.aborted) {
    disposed = true;
    return handle;
  }
  host.append(root);
  ctx.signal.addEventListener('abort', unmount, { once: true });
  try {
    unsubscribe = output.subscribe(refresh);
    if (disposed) unsubscribe();
    else refresh();
  } catch (error) {
    unmount();
    throw error;
  }
  return handle;
}

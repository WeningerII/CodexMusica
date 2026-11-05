// Row 203. The host owns the preview and every consequence of a choice.
export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const port = ctx.environment;
  let alive = !ctx.signal?.aborted;
  let unsubscribe = () => {};
  let shown;
  let pending = null;
  let focusKey = null;
  const root = doc.createElement('section');
  root.className = 'instrument-environment';
  root.setAttribute('aria-label', 'Instrument environment');
  const style = doc.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./environment.css', import.meta.url).href;
  const heading = doc.createElement('h2');
  heading.textContent = 'Environment';
  heading.tabIndex = -1;
  const status = doc.createElement('p');
  status.className = 'ie-status';
  status.tabIndex = -1;
  const source = doc.createElement('p');
  source.className = 'ie-source';
  const fields = doc.createElement('div');
  fields.className = 'ie-fields';
  const controls = new Map();
  root.append(style, heading, status, source, fields);

  function announce(message) {
    if (alive) ctx.announce?.(message);
  }

  function render() {
    if (!alive) return;
    const next = port.snapshot();
    if (
      pending &&
      (next.instrumentId !== pending.instrumentId || next.revision !== pending.revision)
    )
      pending = null;
    shown = next;
    const ready = next.status === 'ready';
    const restoreFocus = ready && doc.activeElement === status;
    root.setAttribute('aria-busy', String(next.status === 'loading' || !!pending));
    const focused = fields.contains(doc.activeElement);
    if (focused) focusKey = doc.activeElement.dataset.field;
    fields.hidden = source.hidden = !ready;
    status.textContent =
      next.status === 'loading'
        ? 'Loading instrument environment…'
        : next.status === 'error'
          ? next.error?.message || 'Instrument environment could not be loaded.'
          : '';
    status.hidden = ready;
    source.textContent = ready ? next.sourceMessage : '';
    if (!ready) {
      if (focused) status.focus();
      return;
    }
    const currentKeys = new Set();
    for (const field of next.fields) {
      currentKeys.add(field.key);
      let control = controls.get(field.key);
      if (!control) {
        const block = doc.createElement('div');
        block.className = 'ie-field';
        const label = doc.createElement('label');
        const title = doc.createElement('span');
        const select = doc.createElement('select');
        select.dataset.field = field.key;
        const descriptors = doc.createElement('p');
        descriptors.className = 'ie-descriptors';
        label.append(title, select);
        block.append(label, descriptors);
        control = { block, title, select, descriptors, options: null };
        controls.set(field.key, control);
        select.addEventListener('change', () => choose(field.key, select.value || null));
      }
      const { block, title, select, descriptors } = control;
      title.textContent = `${field.key === 'tuning' ? 'Tuning' : 'Room'} · ${field.options.length} options`;
      // Keep the select node (and keyboard focus) through every revision.
      const options = JSON.stringify(field.options);
      if (options !== control.options) {
        select.replaceChildren();
        for (const item of [{ id: '', name: 'Not set' }, ...field.options]) {
          const option = doc.createElement('option');
          option.value = item.id;
          option.textContent = item.name;
          select.append(option);
        }
        control.options = options;
      }
      select.value = field.value ?? '';
      select.setAttribute('aria-disabled', String(!!pending));
      descriptors.textContent = field.descriptors.join(', ');
      descriptors.hidden = !field.descriptors.length;
      if (fields.children[[...currentKeys].length - 1] !== block) fields.append(block);
    }
    for (const [key, control] of controls) {
      if (!currentKeys.has(key)) {
        control.block.remove();
        controls.delete(key);
      }
    }
    if (restoreFocus)
      (controls.get(focusKey)?.select || fields.querySelector('select') || heading).focus();
  }

  async function choose(field, id) {
    if (!alive || shown?.status !== 'ready') return;
    if (pending) {
      render();
      announce('Wait for the current environment choice to finish.');
      return;
    }
    const action = { instrumentId: shown.instrumentId, revision: shown.revision };
    pending = action;
    render(); // No optimistic preview state; the host is authoritative.
    try {
      await port.choose({ field, id, revision: action.revision });
      if (!alive || pending !== action) return;
      pending = null;
      render(); // Never install a promise result over a newer host snapshot.
    } catch (error) {
      if (!alive || pending !== action) return;
      pending = null;
      render();
      if (shown.instrumentId !== action.instrumentId) return;
      const message =
        error?.code === 'STALE' || error?.message === 'STALE'
          ? 'Instrument settings changed. Review the current settings and choose again.'
          : 'The environment choice could not be applied. Try choosing again.';
      status.textContent = message;
      status.hidden = false;
      announce(message);
    }
  }

  function unmount() {
    if (!alive) return;
    alive = false;
    pending = null;
    unsubscribe();
    ctx.signal?.removeEventListener('abort', unmount);
    root.remove();
  }

  if (alive) {
    host.append(root);
    unsubscribe = port.subscribe(render);
    ctx.signal?.addEventListener('abort', unmount, { once: true });
    render();
  }
  return {
    unmount,
    focus() {
      if (alive) (fields.hidden ? status : fields.querySelector('select') || heading).focus();
    },
  };
}

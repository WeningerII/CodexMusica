// #668 6647636873: controls only. The shell owns preview, destination and recipe.
export function mount(host, ctx) {
  if (ctx.signal.aborted) return { unmount() {}, focus() {} };
  const doc = host.ownerDocument;
  const root = doc.createElement('section');
  root.className = 'instrument-actions';
  root.setAttribute('aria-label', 'Instrument actions');
  const field = doc.createElement('label');
  const label = doc.createElement('span');
  label.textContent = 'Add to';
  const destination = doc.createElement('select');
  destination.setAttribute('aria-label', 'Add configured instrument to');
  field.append(label, destination);
  const add = doc.createElement('button');
  add.type = 'button';
  add.dataset.action = 'add';
  const reset = doc.createElement('button');
  reset.type = 'button';
  reset.dataset.action = 'reset';
  reset.textContent = 'Reset to catalog defaults';
  const note = doc.createElement('p');
  note.className = 'instrument-actions-note';
  root.append(field, add, reset, note);
  host.append(root);
  let alive = true;
  let pending = false;
  let resetting = false;
  let shown;
  let optionsKey;

  function usable(snapshot) {
    const a = snapshot.instrumentActions;
    return (
      snapshot.status === 'ready' && !snapshot.busy && a?.status === 'ready' && !!a.instrumentId
    );
  }

  function render() {
    if (!alive) return;
    shown = ctx.recipe.snapshot();
    const a = shown.instrumentActions;
    const choices = a?.destinations || [];
    const key = JSON.stringify(choices);
    if (key !== optionsKey) {
      optionsKey = key;
      destination.replaceChildren(
        ...choices.map((choice) => {
          const option = doc.createElement('option');
          option.value = choice.genreId ?? '';
          option.textContent = choice.name;
          return option;
        })
      );
    }
    destination.value = a?.destination ?? '';
    const disabled = pending || !usable(shown);
    destination.disabled = disabled && !(pending && doc.activeElement === destination);
    destination.setAttribute('aria-disabled', String(disabled));
    add.disabled = disabled && !(pending && doc.activeElement === add);
    add.setAttribute('aria-disabled', String(disabled));
    const resetBlocked = disabled || !a?.canReset;
    reset.disabled = resetBlocked && !(resetting && doc.activeElement === reset);
    reset.setAttribute('aria-disabled', String(resetBlocked));
    add.textContent = a?.changedCount > 0 ? 'Add configured instrument' : 'Add instrument';
    root.setAttribute(
      'aria-busy',
      String(pending || shown.busy || shown.status === 'loading' || a?.status === 'loading')
    );
    note.textContent =
      a?.error?.message ||
      (shown.status === 'error' || a?.status === 'error'
        ? 'Instrument actions are unavailable.'
        : !a?.instrumentId
          ? 'Choose an instrument to configure.'
          : a.status === 'loading' || shown.status === 'loading'
            ? 'Loading instrument settings…'
            : '');
    note.hidden = !note.textContent;
  }

  async function run(command, value) {
    if (!alive || pending || !usable(shown)) return;
    const a = shown.instrumentActions;
    if (command === 'resetInstrumentPreview' && !a.canReset) return;
    const args = {
      instrumentId: a.instrumentId,
      revision: shown.revision,
      previewRevision: a.previewRevision,
    };
    if (command === 'setInstrumentDestination') args.destination = value || null;
    if (command === 'addConfiguredInstrument') args.destination = a.destination;
    pending = true;
    resetting = command === 'resetInstrumentPreview';
    render();
    let receipt;
    let resetHadFocus = false;
    try {
      receipt = await ctx.recipe[command](args);
    } catch {
      // The shell owns command outcomes, including STALE/BUSY and failures.
    } finally {
      resetHadFocus = doc.activeElement === reset;
      pending = false;
      resetting = false;
      if (alive) render();
    }
    if (!alive || command !== 'resetInstrumentPreview' || !receipt?.snapshot) return;
    const current = ctx.recipe.snapshot();
    const completed = receipt.snapshot;
    // A late receipt must not focus a different preview, a hidden route, or
    // interrupt someone who moved away from Reset while the host was working.
    if (
      usable(current) &&
      current.revision === completed.revision &&
      current.instrumentActions.previewRevision === completed.instrumentActions?.previewRevision &&
      current.instrumentActions.instrumentId === args.instrumentId &&
      resetHadFocus &&
      root.isConnected &&
      !host.closest('[hidden]')
    )
      add.focus();
  }

  const choose = () => run('setInstrumentDestination', destination.value);
  const addNow = () => run('addConfiguredInstrument');
  const resetNow = () => run('resetInstrumentPreview');
  destination.addEventListener('change', choose);
  add.addEventListener('click', addNow);
  reset.addEventListener('click', resetNow);
  const unsubscribe = ctx.recipe.subscribe(render);
  function unmount() {
    if (!alive) return;
    alive = false;
    unsubscribe();
    destination.removeEventListener('change', choose);
    add.removeEventListener('click', addNow);
    reset.removeEventListener('click', resetNow);
    ctx.signal.removeEventListener('abort', unmount);
    root.remove();
  }
  ctx.signal.addEventListener('abort', unmount, { once: true });
  render();
  return {
    unmount,
    focus() {
      if (alive && !pending && usable(shown) && !host.closest('[hidden]') && !add.disabled)
        add.focus();
    },
  };
}

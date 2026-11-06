// #670 row 204. Don's preview adapter owns all state and engine effects.
// Stage labels are production CHAIN_SECTIONS names (fd16719d); the contract
// supplies stage ids, not stage names. Never infer labels from option ids.
const LABELS = Object.freeze({
  fx: 'Effects',
  amp: 'Amplifier',
  mic: 'Microphone',
  pre: 'Preamplifier',
  comp: 'Compression',
  eq: 'Equalizer',
  medium: 'Medium',
  console: 'Console color',
});

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const root = doc.createElement('section');
  root.className = 'instrument-signal-chain';
  const heading = doc.createElement('h2');
  heading.textContent = 'Signal chain';
  heading.tabIndex = -1;
  const message = doc.createElement('p');
  message.className = 'chain-message';
  const content = doc.createElement('div');
  content.className = 'chain-controls';
  root.append(heading, message, content);
  host.append(root);
  let disposed = false;
  let shown = null;
  let pending = null;
  let unsubscribe = () => {};

  function element(tag, text, className) {
    const el = doc.createElement(tag);
    if (text != null) el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  function focusKey(key) {
    const target = [...content.querySelectorAll('[data-chain-key]')].find(
      (el) => el.dataset.chainKey === key
    );
    (target || heading).focus({ preventScroll: true });
  }

  function select(stage, key) {
    const el = element('select');
    el.dataset.chainStage = stage.stage;
    el.dataset.chainKey = key;
    const placeholder = element('option', stage.multi ? 'Add an effect…' : 'Not set');
    placeholder.value = '';
    el.append(placeholder);
    for (const option of stage.options) {
      if (stage.multi && stage.value.includes(option.id)) continue;
      const item = element('option', option.name);
      item.value = option.id;
      el.append(item);
    }
    el.value = stage.multi ? '' : stage.value || '';
    return el;
  }

  function render(next) {
    if (disposed) return;
    const active = doc.activeElement;
    const inside = root.contains(active);
    let key = active?.dataset?.chainKey;
    if (pending && key === pending.origin) key = pending.focus;
    const changedSelection = shown && shown.instrumentId !== next.instrumentId;
    if (!shown || shown.revision !== next.revision || changedSelection) pending = null;
    shown = next;
    root.setAttribute('aria-busy', String(next.status === 'loading' || !!pending));
    content.replaceChildren();
    if (next.status === 'loading') {
      message.textContent = 'Loading signal chain…';
    } else if (next.status === 'error') {
      message.textContent = next.error?.message || 'Signal chain could not be loaded.';
    } else if (!next.instrumentId) {
      message.textContent = 'Choose an instrument to configure its signal chain.';
    } else {
      message.textContent = `${next.stages.length} stages, recorded in this order. Effects take any number.`;
      for (const stage of next.stages) {
        if (!stage.multi) {
          const label = element('label', null, 'chain-field');
          label.append(element('span', LABELS[stage.stage]), select(stage, stage.stage));
          content.append(label);
          continue;
        }
        const field = element('fieldset', null, 'chain-effects');
        field.append(
          element(
            'legend',
            `${LABELS[stage.stage]} · ${stage.value.length ? stage.value.length + ' chosen' : 'none'}`
          )
        );
        const chips = element('div', null, 'chain-chips');
        for (const id of stage.value) {
          const name = stage.options.find((option) => option.id === id)?.name || id;
          const button = element('button', name, 'chain-remove');
          const removeMark = element('span', '×');
          removeMark.setAttribute('aria-hidden', 'true');
          button.prepend(removeMark);
          button.type = 'button';
          button.setAttribute('aria-label', `Remove ${name}`);
          button.dataset.chainStage = stage.stage;
          button.dataset.chainId = id;
          button.dataset.chainKey = `remove:${id}`;
          chips.append(button);
        }
        const add = select(stage, 'fx-add');
        add.setAttribute('aria-label', 'Add an effect');
        field.append(chips, add);
        content.append(field);
      }
    }
    if (inside) {
      if (changedSelection) heading.focus({ preventScroll: true });
      else focusKey(key);
    }
  }

  function refresh() {
    if (!disposed) render(ctx.chain.snapshot());
  }

  async function choose(stage, id, on, origin, focus) {
    if (disposed || shown?.status !== 'ready') return;
    const displayed = shown;
    const request = { origin, focus };
    pending = request;
    root.setAttribute('aria-busy', 'true');
    try {
      await ctx.chain.choose({ stage, id, on, revision: displayed.revision });
      // The promise may arrive after a subscription or another action. Read
      // the authoritative snapshot, never paint a delayed returned snapshot.
      if (disposed || pending !== request) return;
      refresh();
    } catch (error) {
      if (disposed || pending !== request) return;
      const current = ctx.chain.snapshot();
      if (
        current.instrumentId !== displayed.instrumentId ||
        current.revision !== displayed.revision
      ) {
        render(current);
        return;
      }
      render(current);
      const text =
        error?.message ||
        (error?.code === 'STALE'
          ? 'The instrument changed. Try again.'
          : 'The signal chain change could not be saved.');
      message.textContent = text;
      ctx.announce(text);
    } finally {
      if (!disposed && pending === request) {
        pending = null;
        root.setAttribute('aria-busy', String(shown.status === 'loading'));
      }
    }
  }

  function change(event) {
    const target = event.target;
    if (target.tagName !== 'SELECT' || !content.contains(target)) return;
    const stage = shown.stages.find((item) => item.stage === target.dataset.chainStage);
    if (!stage) return;
    const id = target.value || null;
    // Keep the control canonical while the adapter acts; no optimistic model.
    target.value = stage.multi ? '' : stage.value || '';
    if (stage.multi && id === null) return;
    void choose(
      stage.stage,
      id,
      stage.multi ? true : undefined,
      target.dataset.chainKey,
      target.dataset.chainKey
    );
  }

  function click(event) {
    const button = event.target.closest?.('button[data-chain-id]');
    if (!button || !content.contains(button)) return;
    void choose(
      button.dataset.chainStage,
      button.dataset.chainId,
      false,
      button.dataset.chainKey,
      'fx-add'
    );
  }

  function unmount() {
    if (disposed) return;
    disposed = true;
    pending = null;
    unsubscribe();
    ctx.signal.removeEventListener('abort', unmount);
    root.removeEventListener('change', change);
    root.removeEventListener('click', click);
    root.remove();
  }

  root.addEventListener('change', change);
  root.addEventListener('click', click);
  if (ctx.signal.aborted) unmount();
  else {
    ctx.signal.addEventListener('abort', unmount, { once: true });
    unsubscribe = ctx.chain.subscribe(refresh);
    if (disposed) unsubscribe();
    else refresh();
  }
  return {
    unmount,
    focus: () => {
      if (!disposed) heading.focus({ preventScroll: true });
    },
  };
}

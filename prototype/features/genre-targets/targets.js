// #670 rows 166–169. Frozen contract: #668 comment 6665493327.
// The shell owns targets, results, navigation, and every announcement.
export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const el = (tag, cls, text) => {
    const node = doc.createElement(tag);
    node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const sheet = el('link', 'genre-targets-sheet');
  sheet.rel = 'stylesheet';
  sheet.href = new URL('./targets.css', import.meta.url).href;
  const root = el('section', 'genre-targets');
  root.setAttribute('aria-label', 'Find a sound');
  const heading = el('h2', '', 'Find a sound');
  heading.tabIndex = -1;
  const content = el('div', 'genre-targets-content');
  root.append(heading, content);
  let snapshot;
  let disposed = false;
  let pending = null;
  // Transient user intent only; targets and canonical labels stay shell-owned.
  const intents = new Map();
  let unsubscribe = () => {};
  let focusVersion = 0;
  let restoringFocus = false;
  const events = new AbortController();
  const keyed = (key) =>
    [...root.querySelectorAll('[data-key]')].find((n) => n.dataset.key === key);
  const visible = (node) => !!node?.getClientRects().length;
  function focus(key, fallback = false) {
    const node = keyed(key);
    if (visible(node)) {
      restoringFocus = true;
      node.focus();
      restoringFocus = false;
    } else if (fallback) {
      const toggle = keyed('toggle');
      if (visible(toggle)) {
        restoringFocus = true;
        toggle.focus();
        restoringFocus = false;
      } else ctx.discovery.focusToggle();
    }
  }
  function button(text, key, command, args = [], disabled = false) {
    const node = el('button', 'genre-targets-button', text);
    node.type = 'button';
    node.dataset.key = key;
    node.disabled = disabled;
    node.dataset.command = command;
    node._targetArgs = args;
    return node;
  }
  // Preserve range nodes across host publications, including during a drag.
  function reconcile(old, next) {
    if (old.nodeType === 3) {
      old.textContent = next.textContent;
      return;
    }
    for (const attr of [...old.attributes])
      if (!next.hasAttribute(attr.name)) old.removeAttribute(attr.name);
    for (const attr of [...next.attributes]) old.setAttribute(attr.name, attr.value);
    if (old.tagName === 'INPUT')
      old.value = intents.has(old.dataset.axis)
        ? String(intents.get(old.dataset.axis).value)
        : next.value;
    if (old.tagName === 'BUTTON') old._targetArgs = next._targetArgs;
    const signature = (node) =>
      node.nodeType === 3
        ? '#text'
        : node.tagName + ':' + (node.dataset.key || node.dataset.axis || node.className);
    const available = [...old.childNodes];
    let cursor = old.firstChild;
    for (const wanted of [...next.childNodes]) {
      const index = available.findIndex((node) => signature(node) === signature(wanted));
      const chosen = index < 0 ? wanted : available.splice(index, 1)[0];
      if (chosen !== wanted) reconcile(chosen, wanted);
      if (chosen !== cursor) old.insertBefore(chosen, cursor);
      cursor = chosen.nextSibling;
    }
    for (const obsolete of available) obsolete.remove();
  }
  function render() {
    if (disposed) return;
    const activeKey = root.contains(doc.activeElement) ? doc.activeElement.dataset.key : null;
    snapshot = ctx.targets.current();
    if (snapshot.status !== 'ready') intents.clear();
    const body = el('div', 'genre-targets-body');
    root.setAttribute('aria-busy', String(snapshot.status === 'loading' || !!pending));
    if (snapshot.status !== 'ready') {
      const note = el(
        'p',
        'genre-targets-note',
        snapshot.status === 'loading'
          ? 'Loading sound targets…'
          : snapshot.error?.message || 'Sound targets could not load.'
      );
      body.append(note);
    } else {
      const applied = new Map(snapshot.targets.map((t) => [t.axis, t]));
      const list = el('div', 'genre-targets-axes');
      const axes = snapshot.axes.filter(
        (axis, index) => snapshot.allAxes || index < 3 || applied.has(axis.id)
      );
      for (const axis of axes) {
        const target = applied.get(axis.id);
        const value = target ? target.value : 0;
        const label = target ? target.label : 'Any — not applied';
        const row = el('div', `genre-targets-axis${target ? ' is-applied' : ''}`);
        row.dataset.axis = axis.id;
        if (target) row.dataset.lean = value < 0 ? 'neg' : value > 0 ? 'pos' : 'mid';
        const name = el('label', 'genre-targets-label', axis.name);
        const input = el('input', 'genre-targets-slider');
        input.type = 'range';
        input.min = '-2';
        input.max = '2';
        input.step = '1';
        input.value = String(value);
        input.dataset.axis = axis.id;
        input.dataset.key = 'axis:' + axis.id;
        input.setAttribute('aria-label', axis.name);
        input.setAttribute('aria-valuetext', label);
        input.title = label;
        name.append(input);
        const ends = el('div', 'genre-targets-ends');
        const neg = el('span', 'genre-targets-neg', axis.neg);
        const pos = el('span', 'genre-targets-pos', axis.pos);
        ends.setAttribute('aria-hidden', 'true');
        ends.append(neg, pos);
        const clear = button('×', 'clear:' + axis.id, 'clear', [axis.id]);
        clear.setAttribute('aria-label', `Clear the ${axis.name} target`);
        clear.hidden = !target;
        row.append(name, ends, clear);
        list.append(row);
      }
      const chips = el('div', 'genre-targets-chips');
      for (const target of snapshot.targets) {
        const axis = snapshot.axes.find((a) => a.id === target.axis);
        const chip = button(target.label, 'chip:' + target.axis, 'clear', [target.axis]);
        chip.setAttribute('aria-label', `Clear the ${axis.name} target: ${target.label}`);
        chips.append(chip);
      }
      const status = el(
        'p',
        'genre-targets-note',
        snapshot.applied
          ? `${snapshot.applied} target${snapshot.applied === 1 ? '' : 's'} applied to All genres.`
          : 'Choose a target, then match.'
      );
      body.append(
        button('Reset', 'reset', 'reset', [], !snapshot.applied),
        list,
        chips,
        status,
        button(
          snapshot.allAxes
            ? 'Fewer characteristics'
            : `All ${snapshot.axes.length} characteristics`,
          'toggle',
          'toggleAll'
        ),
        button('Match a sound', 'match', 'match', [], !snapshot.applied)
      );
      body
        .querySelector('[data-key="toggle"]')
        .setAttribute('aria-expanded', String(snapshot.allAxes));
    }
    if (content.firstChild) reconcile(content.firstChild, body);
    else content.append(body);
    if (activeKey && !root.contains(doc.activeElement) && pending?.command !== 'match')
      focus(activeKey);
  }
  async function command(name, args, focusKey, fallback = false, owner = focusVersion) {
    if (disposed || snapshot.status !== 'ready') {
      if (!disposed) render();
      return;
    }
    if (name === 'apply') intents.set(args[0], { value: args[1], focusVersion: owner });
    if (pending) return;
    const revision = snapshot.revision;
    const intent = name === 'apply' ? intents.get(args[0]) : null;
    const operation = { command: name, focusVersion: intent?.focusVersion ?? focusVersion };
    pending = operation;
    root.setAttribute('aria-busy', 'true');
    let acknowledgement;
    try {
      acknowledgement = await ctx.targets[name](...args, revision);
    } catch {
      // STALE/BUSY and other failures are announced by the shell. Never retry.
    } finally {
      if (!disposed && pending === operation) {
        pending = null;
        const latest = ctx.targets.current();
        const accepted =
          acknowledgement &&
          latest.status === 'ready' &&
          acknowledgement.revision === latest.revision;
        // A refusal or superseding revision cancels the entire pending gesture.
        // Never replay an old gesture over a new profile or retry a refusal.
        if (!accepted) intents.clear();
        else if (name === 'apply' && intents.get(args[0])?.value === args[1])
          intents.delete(args[0]);
        // A resolved command carries a revision, never a replacement snapshot.
        render();
        if (
          acknowledgement?.revision === snapshot.revision &&
          operation.focusVersion === focusVersion &&
          name !== 'match'
        ) {
          focus(focusKey, fallback);
        }
        if (accepted) {
          for (const [axis, queued] of intents) {
            if (snapshot.targets.some((t) => t.axis === axis && t.value === queued.value)) {
              intents.delete(axis);
              continue;
            }
            // One new command for the latest unsent intent, at the settled revision.
            // Preserve the original event's focus ownership, even after a blur.
            command('apply', [axis, queued.value], 'axis:' + axis, false, queued.focusVersion);
            break;
          }
        }
      }
    }
  }
  root.addEventListener(
    'focusin',
    () => {
      if (!restoringFocus) focusVersion++;
    },
    { signal: events.signal }
  );
  root.addEventListener(
    'focusout',
    (e) => {
      if (e.relatedTarget && !root.contains(e.relatedTarget)) focusVersion++;
    },
    { signal: events.signal }
  );
  root.addEventListener(
    'input',
    (e) => {
      if (e.target.matches('input[data-axis]'))
        command('apply', [e.target.dataset.axis, Number(e.target.value)], e.target.dataset.key);
    },
    { signal: events.signal }
  );
  root.addEventListener(
    'click',
    (e) => {
      const input = e.target.closest('input[data-axis]');
      if (input) {
        if (!snapshot.targets.some((t) => t.axis === input.dataset.axis))
          command('apply', [input.dataset.axis, Number(input.value)], input.dataset.key);
        return;
      }
      const b = e.target.closest('button[data-command]');
      if (!b || b.disabled) return;
      const name = b.dataset.command;
      const key =
        name === 'clear'
          ? 'axis:' + b._targetArgs[0]
          : name === 'reset'
            ? 'axis:' + snapshot.axes[0].id
            : b.dataset.key;
      command(name, b._targetArgs, key, name === 'clear');
    },
    { signal: events.signal }
  );
  root.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter' && e.target.matches('input[data-axis]')) {
        e.preventDefault();
        command('apply', [e.target.dataset.axis, Number(e.target.value)], e.target.dataset.key);
      }
    },
    { signal: events.signal }
  );
  function unmount() {
    if (disposed) return;
    disposed = true;
    intents.clear();
    unsubscribe();
    events.abort();
    ctx.signal.removeEventListener('abort', unmount);
    root.remove();
    sheet.remove();
  }
  if (ctx.signal.aborted) {
    disposed = true;
    return {
      focus: () => {
        if (!disposed && visible(heading)) heading.focus();
      },
      unmount,
    };
  }
  host.append(sheet, root);
  unsubscribe = ctx.targets.subscribe(render);
  ctx.signal.addEventListener('abort', unmount, { once: true });
  render();
  return {
    focus: () => {
      if (!disposed && visible(heading)) heading.focus();
    },
    unmount,
  };
}

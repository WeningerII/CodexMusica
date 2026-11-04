// Provisional isolated mount contract. The host owns routing and draft persistence.
// Display preferences alone go through the injected P0 wrapper. No host hooks.
let nextId = 0;
export function mount(host, { text = '', onChange = () => {}, storage, announce, signal } = {}) {
  if (!(host instanceof HTMLElement) || typeof text !== 'string')
    throw new TypeError('Editor needs a host and text');
  const id = `proto-lyrics-${++nextId}`;
  if (!signal || signal.aborted || typeof announce !== 'function')
    throw new TypeError('Editor needs an active signal and announcer');
  const listeners = [];
  const listen = (node, type, fn) => {
    node.addEventListener(type, fn, { signal });
    listeners.push([node, type, fn]);
  };
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./editor.css', import.meta.url).href;
  host.append(stylesheet);
  const root = document.createElement('section');
  root.className = 'pl-editor';
  root.setAttribute('aria-label', 'Lyrics editor');
  root.innerHTML = `<div class="pl-toolbar" role="group" aria-label="Document tools">
    <button type="button" data-action="undo">Undo</button><button type="button" data-action="redo">Redo</button>
    <button type="button" data-action="find" aria-expanded="false" aria-controls="${id}-find">Find</button>
    <button type="button" data-action="display" aria-expanded="false" aria-controls="${id}-display">Display</button>
    <button type="button" data-action="outline" aria-expanded="false" aria-controls="${id}-outline">Sections</button></div>
    <div class="pl-find" id="${id}-find" hidden><label>Find text <input type="search" autocomplete="off"></label>
    <button type="button" data-action="previous">Previous</button><button type="button" data-action="next">Next</button>
    <button type="button" data-action="close-find">Close Find</button><output aria-live="polite"></output><ol class="pl-hits" aria-label="Matching lines"></ol></div>
    <div id="${id}-display" hidden><label>Text size <select><option value="1">Standard</option><option value="1.25">Large</option><option value="1.5">Largest</option></select></label>
    <label><input type="checkbox"> Line numbers</label><button type="button" data-action="close-display">Close Display</button></div>
    <div class="pl-work"><aside id="${id}-outline" hidden aria-label="Sections"><button type="button" data-action="close-outline">Close Sections</button><p class="pl-summary"></p><nav aria-label="Document sections"></nav></aside>
    <div class="pl-document"><label for="${id}-draft">Lyrics draft</label><div class="pl-input-wrap"><div class="pl-numbers" aria-hidden="true"></div><textarea id="${id}-draft" spellcheck="true" wrap="soft"></textarea></div><p class="pl-position"></p></div></div>
    `;
  host.append(root);
  const q = (selector) => root.querySelector(selector);
  const button = (name) => q(`[data-action="${name}"]`);
  const draft = q('textarea'),
    findPanel = q('.pl-find'),
    query = q('input[type="search"]');
  const display = q(`#${id}-display`),
    outline = q('aside');
  const size = q('select'),
    numbers = q('input[type="checkbox"]');
  draft.value = text;
  let rawText = text;
  let disposed = false,
    composing = false,
    timer,
    group = null,
    previous = null,
    index = 0;
  let history = [{ text: draft.value, raw: rawText, start: 0, end: 0 }],
    matches = [],
    activeMatch = -1,
    sections = [];
  let pref = { size: '1', numbers: false };
  function tell(message) {
    if (disposed) return;
    announce(message);
  }
  function readPrefs() {
    try {
      const result = storage?.read('display');
      if (disposed) return;
      if (result?.ok && result.value) {
        pref = {
          size: ['1', '1.25', '1.5'].includes(result.value.size) ? result.value.size : '1',
          numbers: result.value.numbers === true,
        };
      } else if (result && !result.ok) tell('Display settings unavailable. Editing still works.');
    } catch {
      tell('Display settings unavailable. Editing still works.');
    }
    if (disposed) return;
    size.value = pref.size;
    numbers.checked = pref.numbers;
  }
  function savePrefs() {
    pref = { size: size.value, numbers: numbers.checked };
    try {
      if (!storage?.write('display', pref)?.ok)
        tell('Display settings not saved. Editing still works.');
    } catch {
      tell('Display settings not saved. Editing still works.');
    }
    applyPrefs();
  }
  const snapshot = () => ({
    text: draft.value,
    raw: rawText,
    start: draft.selectionStart,
    end: draft.selectionEnd,
  });
  function closeGroup() {
    clearTimeout(timer);
    group = null;
  }
  function buttons() {
    button('undo').disabled = index === 0;
    button('redo').disabled = index === history.length - 1;
  }
  function notify() {
    if (disposed) return;
    onChange(rawText);
  }
  function captureRaw() {
    // Textareas normalize CR/CRLF. Preserve untouched source bytes in the model,
    // mapping only the changed normalized range back into the original document.
    const before = rawText.replace(/\r\n?/g, '\n'),
      after = draft.value;
    let start = 0,
      end = 0;
    while (start < before.length && start < after.length && before[start] === after[start]) start++;
    while (
      end < before.length - start &&
      end < after.length - start &&
      before[before.length - 1 - end] === after[after.length - 1 - end]
    )
      end++;
    // A common-prefix diff is ambiguous for adjacent equivalent newlines.
    // Prefer the browser's actual replacement range and resulting caret.
    if (previous?.text === before) {
      const editStart = Math.min(previous.start, draft.selectionStart);
      const suffixLength = after.length - draft.selectionEnd;
      const oldEnd = before.length - suffixLength;
      if (
        oldEnd >= previous.end &&
        oldEnd >= editStart &&
        before.slice(0, editStart) === after.slice(0, editStart) &&
        before.slice(oldEnd) === after.slice(draft.selectionEnd)
      ) {
        start = editStart;
        end = suffixLength;
      }
    }
    const rawOffset = (normalizedOffset) => {
      let raw = 0,
        normalized = 0;
      while (normalized < normalizedOffset) {
        raw += rawText[raw] === '\r' && rawText[raw + 1] === '\n' ? 2 : 1;
        normalized++;
      }
      return raw;
    };
    const newline = rawText.includes('\r\n')
      ? '\r\n'
      : rawText.includes('\r') && !rawText.includes('\n')
        ? '\r'
        : '\n';
    rawText =
      rawText.slice(0, rawOffset(start)) +
      after.slice(start, after.length - end).replace(/\n/g, newline) +
      rawText.slice(rawOffset(before.length - end));
  }
  function record(kind) {
    if (draft.value === history[index].text) return;
    captureRaw();
    if (!group || group !== kind) {
      history = history.slice(0, index + 1);
      if (previous) {
        history[index].start = previous.start;
        history[index].end = previous.end;
      }
      history.push(snapshot());
      index++;
    } else history[index] = snapshot();
    group = kind;
    clearTimeout(timer);
    timer = setTimeout(closeGroup, 1000);
    if (kind === 'whole') closeGroup();
    buttons();
    notify();
    refresh();
  }
  function step(redo) {
    closeGroup();
    const target = index + (redo ? 1 : -1);
    if (target < 0 || target >= history.length) return;
    const from = document.activeElement;
    index = target;
    const state = history[index];
    draft.value = state.text;
    rawText = state.raw;
    draft.setSelectionRange(state.start, state.end);
    buttons();
    refresh();
    notify();
    if (disposed) return;
    if (from === draft) draft.focus({ preventScroll: true });
    else if (from === button('undo') || from === button('redo')) {
      (from.disabled ? (redo ? button('undo') : button('redo')) : from).focus();
    }
    tell(redo ? 'Redone' : 'Undone');
  }
  function rows() {
    let offset = 0;
    return draft.value.split('\n').map((raw, i) => {
      const row = { raw, start: offset, n: i + 1 };
      offset += raw.length + 1;
      return row;
    });
  }
  function updateNumbers() {
    if (disposed) return;
    const gutter = q('.pl-numbers');
    gutter.hidden = !numbers.checked;
    gutter.style.height = `${draft.getBoundingClientRect().height}px`;
    gutter.replaceChildren();
    if (!numbers.checked) return;
    // Measure each logical line using the same wrapping width and font as the textarea.
    const measure = document.createElement('div');
    measure.className = 'pl-measure';
    measure.style.width = `${draft.clientWidth - 24}px`;
    root.append(measure);
    for (const row of rows()) {
      measure.textContent = row.raw || '\u200b';
      const label = document.createElement('div');
      label.textContent = row.n;
      label.style.height = `${measure.getBoundingClientRect().height}px`;
      gutter.append(label);
    }
    measure.remove();
    gutter.scrollTop = draft.scrollTop;
  }
  function applyPrefs() {
    if (disposed) return;
    root.style.setProperty('--pl-size', `${size.value}rem`);
    updateNumbers();
  }
  function updateCaret() {
    if (disposed) return;
    const at = draft.selectionStart;
    const row = rows()
      .filter((r) => r.start <= at)
      .at(-1);
    q('.pl-position').textContent = `Line ${row.n} of ${rows().length}`;
    const current = sections.filter((s) => s.start <= at).at(-1);
    outline.querySelectorAll('[data-start]').forEach((node) => {
      if (Number(node.dataset.start) === current?.start)
        node.setAttribute('aria-current', 'location');
      else node.removeAttribute('aria-current');
    });
  }
  function go(start, end = start) {
    closeGroup();
    draft.focus({ preventScroll: true });
    if (disposed) return;
    draft.setSelectionRange(start, end);
    const measure = document.createElement('div');
    measure.className = 'pl-measure';
    measure.style.width = `${draft.clientWidth - 24}px`;
    measure.textContent = draft.value.slice(0, start) + '\u200b';
    root.append(measure);
    draft.scrollTop = Math.max(0, measure.getBoundingClientRect().height - draft.clientHeight / 2);
    measure.remove();
    updateCaret();
  }
  function findMatches() {
    matches = [];
    if (query.value) {
      // Literal Unicode matching: never normalize or strip punctuation from the draft.
      const escaped = query.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let sung = 0;
      for (const row of rows()) {
        if (!row.raw.trim() || /^\[[^\]]*\]$/.test(row.raw.trim())) continue;
        sung++;
        const match = new RegExp(escaped, 'iu').exec(row.raw);
        if (match)
          matches.push({
            start: row.start + match.index,
            end: row.start + match.index + match[0].length,
            line: sung,
          });
      }
    }
    activeMatch = -1;
    q('output').textContent = `${matches.length} matching lines`;
    button('previous').disabled = button('next').disabled = matches.length === 0;
    const list = q('.pl-hits');
    list.replaceChildren();
    // Explicit match excerpts, not a replacement rendering of the editable text.
    matches.forEach((match, i) => {
      const li = document.createElement('li'),
        item = document.createElement('button'),
        mark = document.createElement('mark');
      item.type = 'button';
      item.dataset.match = i;
      const line = match.line;
      item.append(`Line ${line}: `);
      mark.textContent = draft.value.slice(match.start, match.end);
      item.append(mark);
      li.append(item);
      list.append(li);
    });
  }
  function findStep(direction) {
    if (!matches.length) return;
    if (activeMatch === -1 && direction < 0) activeMatch = 0;
    activeMatch = (activeMatch + direction + matches.length) % matches.length;
    const hit = matches[activeMatch];
    go(hit.start, hit.end);
    if (disposed) return;
    q('output').textContent = `${activeMatch + 1} of ${matches.length} lines`;
    query.focus({ preventScroll: true });
  }
  function refresh() {
    if (disposed) return;
    const rawRows = rows();
    // P1's basic row classification. This does not parse declaration semantics.
    const bracket = /^\[[^\]]*\]$/;
    const metadata = /^\[(?:FINISHED|GRADED)\b|^\[SETUP\s+—\s+/i;
    const hasHeaders = rawRows.some(
      (r) => bracket.test(r.raw.trim()) && !metadata.test(r.raw.trim())
    );
    sections = [];
    let section = null,
      sungCount = 0;
    for (const row of rawRows) {
      const value = row.raw.trim();
      if (!value) {
        if (!hasHeaders) section = null;
        continue;
      }
      if (bracket.test(value)) {
        if (!metadata.test(value)) {
          section = {
            ...row,
            title: value
              .slice(1, -1)
              .split(/\s+—\s+/)[0]
              .trim(),
            count: 0,
          };
          sections.push(section);
        }
        continue;
      }
      if (!section) {
        section = { ...row, title: `Stanza ${sections.length + 1}`, count: 0 };
        sections.push(section);
      }
      section.count++;
      sungCount++;
    }
    const nav = outline.querySelector('nav');
    nav.replaceChildren();
    sections.forEach((section) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.dataset.start = section.start;
      item.textContent = `${section.title} · ${section.count} lines`;
      nav.append(item);
    });
    q('.pl-summary').textContent = `${sungCount} sung lines · ${sections.length} sections`;
    findMatches();
    updateCaret();
    updateNumbers();
  }
  function toggle(panel, action, open) {
    closeGroup();
    panel.hidden = !open;
    button(action).setAttribute('aria-expanded', String(open));
    if (open) {
      if (action === 'find') query.focus();
      // Nonmodal display and outline disclosures leave focus on their trigger.
    } else button(action).focus();
  }
  listen(root, 'click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'undo' || action === 'redo') step(action === 'redo');
    else if (action === 'find') toggle(findPanel, action, findPanel.hidden);
    else if (action === 'display') toggle(display, action, display.hidden);
    else if (action === 'outline') toggle(outline, action, outline.hidden);
    else if (action === 'close-find') toggle(findPanel, 'find', false);
    else if (action === 'close-display') toggle(display, 'display', false);
    else if (action === 'close-outline') toggle(outline, 'outline', false);
    else if (action === 'next' || action === 'previous') findStep(action === 'next' ? 1 : -1);
    else if (target.dataset.match !== undefined) {
      activeMatch = Number(target.dataset.match) - 1;
      findStep(1);
    } else if (target.dataset.start !== undefined) go(Number(target.dataset.start));
  });
  listen(root, 'keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      const panel = [findPanel, display, outline].find(
        (p) => !p.hidden && p.contains(event.target)
      );
      if (panel || (!findPanel.hidden && event.target === draft)) {
        event.preventDefault();
        toggle(
          panel || findPanel,
          panel === display ? 'display' : panel === outline ? 'outline' : 'find',
          false
        );
      }
    }
    if (event.target === query && event.key === 'Enter') {
      event.preventDefault();
      findStep(event.shiftKey ? -1 : 1);
    }
    if (event.target !== draft) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && ['z', 'y'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      step(event.key.toLowerCase() === 'y' || event.shiftKey);
      return;
    }
    if (
      [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
        'PageUp',
        'PageDown',
      ].includes(event.key)
    )
      closeGroup();
  });
  listen(draft, 'beforeinput', (event) => {
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault();
      step(event.inputType === 'historyRedo');
      return;
    }
    if (!composing) previous = snapshot();
  });
  listen(draft, 'input', (event) => {
    if (composing) return;
    const type = event.inputType || '';
    record(
      /Paste|Drop|Cut|Replacement/.test(type)
        ? 'whole'
        : type.startsWith('delete')
          ? 'delete'
          : 'insert'
    );
  });
  listen(draft, 'compositionstart', () => {
    closeGroup();
    previous = snapshot();
    composing = true;
  });
  listen(draft, 'compositionend', () => {
    composing = false;
    record('whole');
  });
  listen(draft, 'pointerdown', closeGroup);
  listen(draft, 'blur', closeGroup);
  listen(draft, 'keyup', updateCaret);
  listen(draft, 'click', updateCaret);
  listen(draft, 'select', updateCaret);
  listen(draft, 'scroll', () => {
    q('.pl-numbers').scrollTop = draft.scrollTop;
  });
  listen(query, 'input', findMatches);
  listen(size, 'change', savePrefs);
  listen(numbers, 'change', savePrefs);
  const observer = new ResizeObserver(() => {
    if (!disposed) updateNumbers();
  });
  function unmount() {
    if (disposed) return;
    disposed = true;
    closeGroup();
    observer.disconnect();
    signal.removeEventListener('abort', unmount);
    for (const [node, type, fn] of listeners) node.removeEventListener(type, fn);
    root.remove();
    stylesheet.remove();
  }
  // This lifecycle listener cannot use its own signal as a removal signal:
  // doing so would remove it before the abort event can run the cleanup.
  signal.addEventListener('abort', unmount, { once: true });
  observer.observe(draft);
  readPrefs();
  // An injected host callback can abort synchronously while mounting.
  if (signal.aborted) unmount();
  if (!disposed) {
    applyPrefs();
    refresh();
    buttons();
  }
  return {
    focus() {
      if (!disposed) draft.focus();
    },
    unmount,
  };
}

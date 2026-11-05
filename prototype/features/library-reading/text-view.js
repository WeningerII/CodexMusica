// #670 rows 239–241. Source: src/library/reader.js blob
// 1ba2bd41278437d4ec3ce05c09c6dc2b5ca3d5d6: derive, shownLines, lineHTML.
// Host contract: {unitId, reading(unitId), storage, announce, signal}.
// reading resolves {head, loadPage(index, {signal})}; the shell verifies hashes,
// decodes gzip, and owns transport. The host supplies the selected unitId.
// head.pages lists subsequent page hashes; head.page_count bounds navigation.
// Production head has NO page-size/row-boundary table. Row boundaries therefore
// use head.start/head.lines and each verified page.start/page.lines, checking
// adjacency as pages arrive. Never infer row_start from index or a fixed size.
// The verified host owns page payload size (the head declares no maximum).
// Only the current page is retained/rendered; there is no accumulated page cache. Source ranges are codepoints,
// NOT JS string indices. No range slicing, annotations or persistent text cache.
const SHOWN = new Set(['lyric', 'blank', 'structure']);
const changed = (message) => Object.assign(Error(message), { code: 'DATA_CHANGED' });
const integer = (n) => Number.isSafeInteger(n) && n >= 0;

export function decodePage(head, page, index) {
  if (
    !head ||
    !page ||
    typeof head.reading_unit_id !== 'string' ||
    typeof head.reading_revision !== 'string' ||
    !integer(head.page_count) ||
    head.page_count < 1 ||
    !Array.isArray(head.pages) ||
    head.pages.length + 1 !== head.page_count ||
    !integer(index) ||
    index >= head.page_count ||
    page.reading_unit_id !== head.reading_unit_id ||
    page.reading_revision !== head.reading_revision ||
    page.page_index !== index ||
    page.page_count !== head.page_count ||
    !Array.isArray(page.lines)
  ) {
    throw changed('The reading page does not match the requested reading.');
  }
  const s = page.start;
  if (
    !s ||
    ![
      'row_start',
      'analysis_line_start',
      'normalized_cp_start',
      'normalized_utf16_start',
      'physical_line_start',
    ].every((k) => integer(s[k])) ||
    (index === 0 && s.row_start !== 0)
  )
    throw changed('The reading page has invalid offsets.');
  let cp = s.normalized_cp_start,
    utf = s.normalized_utf16_start,
    sung = s.analysis_line_start;
  return page.lines.map((tuple, i) => {
    if (!Array.isArray(tuple)) throw changed('Invalid reading row.');
    const [kind, text, indent, physical, analysis, srcCp, srcText] = tuple;
    if (
      typeof kind !== 'string' ||
      typeof text !== 'string' ||
      !integer(indent) ||
      !integer(physical) ||
      (srcText != null && typeof srcText !== 'string')
    )
      throw changed('Invalid reading row.');
    let cpRange = null,
      utfRange = null,
      number = null;
    if (kind === 'lyric') {
      if (sung) {
        cp++;
        utf++;
      }
      number = ++sung;
      cpRange = [cp, cp + Array.from(text).length];
      utfRange = [utf, utf + text.length];
      cp = cpRange[1];
      utf = utfRange[1];
    }
    if (analysis !== number) throw changed('Line numbering does not match the page offsets.');
    return {
      kind,
      text,
      indent,
      physical,
      number,
      row: s.row_start + i,
      source: srcText == null ? text : srcText,
      sourceCp: srcCp,
      cpRange,
      utfRange,
    };
  });
}

function pageBoundary(page, decoded) {
  const last = decoded.findLast((r) => r.kind === 'lyric');
  return {
    start: page.start,
    end: {
      row_start: page.start.row_start + decoded.length,
      analysis_line_start: last?.number ?? page.start.analysis_line_start,
      normalized_cp_start: last?.cpRange[1] ?? page.start.normalized_cp_start,
      normalized_utf16_start: last?.utfRange[1] ?? page.start.normalized_utf16_start,
    },
  };
}
const adjacent = (a, b) =>
  ['row_start', 'analysis_line_start', 'normalized_cp_start', 'normalized_utf16_start'].every(
    (k) => a[k] === b[k]
  );

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const root = doc.createElement('section');
  root.className = 'lr-text-view';
  root.setAttribute('aria-label', 'Reading text');
  const make = (tag, text, parent = root) => {
    const el = doc.createElement(tag);
    el.textContent = text;
    parent.append(el);
    return el;
  };
  let dead = false,
    generation = 0,
    index = 0,
    rows = [],
    source = false,
    busy = false;
  let head = null,
    loadPage = null,
    boundary = null;
  let size = 20;
  try {
    const r = ctx.storage?.read('text-size');
    if (r?.ok && Number.isFinite(r.value)) size = Math.max(16, Math.min(32, r.value));
  } catch {
    /* preferences never prevent reading */
  }
  const title = make('h2', 'Reading');
  title.tabIndex = -1;
  const controls = make('div', '');
  controls.className = 'lr-controls';
  const button = (text) => {
    const b = make('button', text, controls);
    b.type = 'button';
    return b;
  };
  const toggle = button('Source transcription');
  toggle.setAttribute('aria-pressed', 'false');
  const smaller = button('Smaller text'),
    larger = button('Larger text');
  const output = make('span', '', controls);
  const previous = button('Previous page'),
    next = button('Next page');
  const status = make('p', '');
  status.dataset.lrStatus = ''; // The shell owns the one live announcement region.
  const viewport = make('div', '');
  viewport.className = 'lr-lines';
  const say = (text) => {
    if (!dead) {
      status.textContent = text;
      ctx.announce?.(text);
    }
  };
  const sizeUI = () => {
    viewport.style.fontSize = size + 'px';
    output.textContent = size + ' px';
    smaller.disabled = size <= 16;
    larger.disabled = size >= 32;
  };
  const pagingUI = () => {
    previous.disabled = index === 0 || typeof loadPage !== 'function';
    next.disabled = index >= (head?.page_count || 1) - 1 || typeof loadPage !== 'function';
    previous.setAttribute('aria-disabled', String(busy || previous.disabled));
    next.setAttribute('aria-disabled', String(busy || next.disabled));
    viewport.setAttribute('aria-busy', String(busy));
  };
  const render = () => {
    viewport.replaceChildren();
    for (const row of rows) {
      if (!source && !SHOWN.has(row.kind)) continue;
      const line = make('div', '', viewport);
      line.className = 'lr-line';
      line.dataset.row = String(row.row);
      line.dataset.kind = row.kind;
      const num = make('span', String(source ? row.physical : (row.number ?? '')), line);
      num.className = 'lr-number';
      num.setAttribute(
        'aria-label',
        source ? 'Source line ' + row.physical : row.number ? 'Analysis line ' + row.number : ''
      );
      const text = make('span', source ? row.source : row.text, line);
      text.className = 'lr-text';
      text.style.paddingInlineStart = (source ? 0 : Math.min(row.indent, 30)) + 'ch';
    }
    sizeUI();
    pagingUI();
  };
  const changeSize = (delta) => {
    size = Math.max(16, Math.min(32, size + delta));
    sizeUI();
    let saved = false;
    try {
      saved = ctx.storage?.write('text-size', size)?.ok === true;
    } catch {
      /* report refusal */
    }
    say('Text size ' + size + ' pixels.' + (saved ? '' : ' Not saved in this browser.'));
  };
  const failure = (error) => {
    if (error?.name === 'AbortError') {
      status.textContent = '';
      return;
    }
    if (error?.code === 'DATA_CHANGED') {
      const focused = doc.activeElement;
      rows = [];
      head = null;
      loadPage = null;
      toggle.disabled = true;
      render();
      if (focused === previous || focused === next || focused === toggle) title.focus();
      say('This reading changed or failed its page checks. No text is shown. Reopen the reading.');
    } else {
      const reason =
        error?.code === 'NOT_FOUND'
          ? 'The requested reading page was not found.'
          : 'The requested reading page could not be loaded.';
      say(
        reason +
          (rows.length
            ? ' The previous page is still displayed. Try again.'
            : ' Reopen the reading to try again.')
      );
    }
  };
  const turn = async (target) => {
    if (dead || busy || !head || target < 0 || target >= head.page_count || !loadPage) return;
    const mine = ++generation;
    busy = true;
    pagingUI();
    say('Loading reading page…');
    try {
      const page = await loadPage(target, { signal: ctx.signal });
      if (dead || mine !== generation) return;
      const decoded = decodePage(head, page, target);
      const nextBoundary = pageBoundary(page, decoded);
      if (
        (target > index && !adjacent(nextBoundary.start, boundary.end)) ||
        (target < index && !adjacent(nextBoundary.end, boundary.start))
      )
        throw changed('Nonadjacent page coordinates.');
      boundary = nextBoundary;
      const focused = doc.activeElement;
      rows = decoded;
      index = target;
      render();
      viewport.scrollTop = 0;
      if ((focused === previous || focused === next) && focused.disabled) title.focus();
      say('Page ' + (index + 1) + ' of ' + head.page_count);
    } catch (error) {
      if (!dead && mine === generation) failure(error);
    } finally {
      if (!dead && mine === generation) {
        busy = false;
        pagingUI();
      }
    }
  };
  const click = (e) => {
    if (dead) return;
    if (e.target === toggle) {
      source = !source;
      toggle.setAttribute('aria-pressed', String(source));
      render();
      say(source ? 'Source transcription' : 'Normalized reading text');
    } else if (e.target === smaller) changeSize(-2);
    else if (e.target === larger) changeSize(2);
    else if (e.target === previous) void turn(index - 1);
    else if (e.target === next) void turn(index + 1);
  };
  function unmount() {
    if (dead) return;
    dead = true;
    generation++;
    rows = [];
    root.removeEventListener('click', click);
    ctx.signal?.removeEventListener('abort', unmount);
    root.remove();
  }
  if (ctx.signal?.aborted) {
    dead = true;
    return { unmount, focus() {} };
  }
  root.addEventListener('click', click, { signal: ctx.signal });
  ctx.signal?.addEventListener('abort', unmount, { once: true });
  const stylesheet = doc.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./text-view.css', import.meta.url).href;
  root.append(stylesheet);
  host.append(root);
  toggle.disabled = true;
  busy = true;
  render();
  say('Loading reading…');
  const mine = ++generation;
  Promise.resolve()
    .then(() => {
      if (dead) return null;
      if (typeof ctx.reading !== 'function' || typeof ctx.unitId !== 'string')
        throw Object.assign(Error('Missing reading host contract.'), { code: 'LOAD_FAILED' });
      return ctx.reading(ctx.unitId);
    })
    .then((record) => {
      if (dead || mine !== generation) return;
      head = record?.head;
      if (head?.reading_unit_id !== ctx.unitId || typeof record?.loadPage !== 'function')
        throw changed('The host returned an incomplete or different reading.');
      rows = decodePage(head, head, 0);
      loadPage = record.loadPage;
      boundary = pageBoundary(head, rows);
      title.textContent = typeof head.title === 'string' ? head.title : 'Reading';
      viewport.dir = head.direction === 'rtl' ? 'rtl' : 'ltr';
      viewport.lang = typeof head.language === 'string' ? head.language : '';
      toggle.disabled = false;
      render();
      say('Page 1 of ' + head.page_count);
    })
    .catch((error) => {
      if (!dead && mine === generation) failure(error);
    })
    .finally(() => {
      if (!dead && mine === generation) {
        busy = false;
        pagingUI();
      }
    });
  return {
    unmount,
    focus() {
      if (!dead) title.focus();
    },
  };
}

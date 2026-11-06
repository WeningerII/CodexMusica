// #670 Instrument catalog. Frozen host projections, never an engine or recipe writer.
// Contract: #668 6647648469; shared destination: #668 6647636873.
export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const root = doc.createElement('section');
  root.className = 'icatalog';
  root.setAttribute('aria-label', 'Instrument catalog');
  const css = doc.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('./catalog.css', import.meta.url).href;
  host.append(css, root);
  let disposed = false,
    controller,
    sequence = 0,
    timer,
    data;
  let query = '',
    family = '',
    cls = '',
    sort = 'name',
    limit = 50,
    catsOpen = false;
  let filters = new Set(),
    openGroups = new Set(['behaviour', 'voicing', 'pitch']);
  let view = ctx.storage?.read('view')?.value === 'list' ? 'list' : 'rows';
  const failedPhotos = new Set();
  const pendingAdds = new Set();
  let rowFrame = 0,
    rowAim = null;
  const el = (tag, text, attrs = {}) => {
    const n = doc.createElement(tag);
    if (text != null) n.textContent = text;
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  };
  const button = (text, key, run, attrs = {}) => {
    const n = el('button', text, { type: 'button', 'data-key': key, ...attrs });
    n.addEventListener('click', run);
    return n;
  };
  const safeLink = (href) => typeof href === 'string' && /^https?:\/\//i.test(href);
  const heading = el('h2', 'Instruments', { tabindex: '-1' });
  const toolbar = el('div', null, { class: 'ic-toolbar' });
  const label = el('label', 'Search instruments');
  const search = el('input', null, { type: 'search', 'aria-label': 'Search instruments' });
  label.append(search);
  toolbar.append(label);
  const body = el('div', null, { class: 'ic-body' });
  const note = el('p', '', { class: 'ic-note' });
  root.append(heading, toolbar, note, body);
  function message(text) {
    if (!disposed) note.textContent = text;
  }
  function invoke(fn, args, unavailable) {
    if (typeof fn !== 'function') {
      message(unavailable);
      return;
    }
    try {
      Promise.resolve(fn(...args)).catch((e) => message(e.message || unavailable));
    } catch (e) {
      message(e.message || unavailable);
    }
  }
  function snapshot() {
    return ctx.recipe?.snapshot?.();
  }
  function destination(s) {
    // Never infer Independent from a missing projection.
    return s?.instrumentActions && Object.hasOwn(s.instrumentActions, 'destination')
      ? s.instrumentActions.destination
      : undefined;
  }
  function destinationName(s) {
    const d = destination(s);
    if (d === undefined) return null;
    if (d === null) return 'Independent instrument';
    return (
      s.instrumentActions.destinations?.find((x) => x.genreId === d)?.name ||
      s.groups?.find((x) => x.genreId === d)?.name ||
      d
    );
  }
  function syncRecipe() {
    if (disposed) return;
    const s = snapshot();
    for (const b of root.querySelectorAll('[data-add]')) {
      const name = data?.items.find((i) => i.id === b.dataset.add)?.name || b.dataset.add;
      const dest = destinationName(s);
      b.disabled = !!s?.busy || pendingAdds.has(b.dataset.add);
      b.setAttribute(
        'aria-label',
        dest
          ? 'Add ' + name + ' with catalog defaults to ' + dest
          : 'Add ' + name + ' — destination unavailable in this build'
      );
    }
  }
  function add(item) {
    const s = snapshot(),
      dest = destination(s);
    if (
      dest === undefined ||
      s?.status !== 'ready' ||
      typeof ctx.recipe?.addInstrument !== 'function'
    ) {
      message('Adding instruments with the shared destination isn’t available in this build.');
      return;
    }
    if (s.busy || pendingAdds.has(item.id)) return;
    message('');
    pendingAdds.add(item.id);
    syncRecipe();
    // This is plain catalog Add: no preview card/configuration crosses the boundary.
    let result;
    try {
      result = ctx.recipe.addInstrument({
        instrumentId: item.id,
        destination: dest,
        revision: s.revision,
      });
    } catch (e) {
      result = Promise.reject(e);
    }
    Promise.resolve(result)
      .catch((e) => message(e?.message || ''))
      .finally(() => {
        pendingAdds.delete(item.id);
        syncRecipe();
      });
    // The host owns placement feedback and focus, including late outcomes.
  }
  function photo(item) {
    const box = el('div', null, { class: 'ic-photo' });
    const p = item.photo;
    if (!p) return box;
    const credit = 'Photo: ' + [p[2] || 'uncredited', p[1] || 'licence not stated'].join(' · ');
    const src = !failedPhotos.has(item.id) && ctx.media?.resolve?.(p[0]);
    if (src) {
      const b = button(
        '',
        'photo:' + item.id,
        () =>
          invoke(
            ctx.openPhoto,
            [p, { returnFocus: b }],
            'Photo enlargement isn’t available in this build.'
          ),
        { 'aria-label': 'Enlarge photo of ' + item.name }
      );
      const img = el('img', null, { src, alt: '', loading: 'lazy', width: '72', height: '72' });
      img.addEventListener(
        'error',
        () => {
          failedPhotos.add(item.id);
          b.replaceWith(el('span', 'Photo unavailable'));
        },
        { once: true }
      );
      b.append(img);
      box.append(b);
    } else box.append(el('span', 'Photo unavailable'));
    const c = safeLink(p[3])
      ? el('a', credit, { href: p[3], target: '_blank', rel: 'noopener noreferrer' })
      : el('span', credit);
    box.append(c);
    return box;
  }
  function card(item) {
    const li = el('li', null, { class: 'ic-card', 'data-item': item.id });
    if (ctx.instrument?.current?.() === item.id) li.setAttribute('aria-current', 'true');
    li.append(photo(item));
    const open = button(
      item.name,
      'open:' + item.id,
      () =>
        invoke(
          ctx.openInstrument,
          [item.id, { returnFocus: open }],
          'Opening instruments isn’t available in this build.'
        ),
      {
        class: 'ic-open',
        'data-open': item.id,
        'aria-label': item.name + ': configure before adding',
      }
    );
    const f = data.families.find((x) => x.id === item.familyId);
    const c = f?.classes.find((x) => x.id === item.classId);
    li.append(
      open,
      el(
        'p',
        (f?.name || item.familyId) +
          ' · ' +
          (c?.name || item.classId) +
          ' · ' +
          item.partCount +
          ' customizable ' +
          (item.partCount === 1 ? 'part' : 'parts')
      )
    );
    const actions = el('div', null, { class: 'ic-actions' });
    if (safeLink(item.listenHref))
      actions.append(
        el('a', 'Listen', {
          href: item.listenHref,
          target: '_blank',
          rel: 'noopener noreferrer',
          'aria-label': 'Listen to ' + item.name,
        })
      );
    else actions.append(el('span', 'Listen unavailable'));
    actions.append(button('Add', 'add:' + item.id, () => add(item), { 'data-add': item.id }));
    li.append(actions);
    return li;
  }
  function selected(i, fs = filters) {
    return [...fs].every((id) => i.propertyIds.includes(id));
  }
  function inCategory(i, f = family, c = cls) {
    return (!f || i.familyId === f) && (!c || i.classId === c);
  }
  function preserveFocus(key) {
    if (!key) return;
    const target = [...body.querySelectorAll('[data-key]')].find((n) => n.dataset.key === key);
    (target || body.querySelector('.ic-results h3'))?.focus();
  }
  function change(fn, key, announce = true) {
    fn();
    render();
    preserveFocus(key);
    if (announce) ctx.announce?.(body.querySelector('[data-count]')?.textContent || '');
  }
  function familySelect(id) {
    family = id;
    cls = '';
    limit = 50;
  }
  function render() {
    if (disposed || !data) return;
    clearTimeout(timer);
    const projection = ctx.catalog.search(query);
    const q = projection.normalizedQuery;
    const ranks = new Map(projection.matches.map((m) => [m.id, m.rank]));
    const searched = data.items.filter((i) => !q || ranks.has(i.id));
    const scope = searched.filter((i) => selected(i));
    const local = searched.filter((i) => inCategory(i));
    const filtered = scope.filter((i) => inCategory(i));
    filtered.sort((a, b) => {
      if (sort === 'name-desc') return b.nameOrder - a.nameOrder;
      if (sort === 'parts') return b.partCount - a.partCount || a.nameOrder - b.nameOrder;
      return (q ? ranks.get(a.id) - ranks.get(b.id) : 0) || a.nameOrder - b.nameOrder;
    });
    const positions = new Map(
      [...body.querySelectorAll('[data-track]')].map((n) => [
        n.dataset.track,
        { left: n.scrollLeft, signature: n.dataset.signature },
      ])
    );

    body.replaceChildren();
    body.classList.toggle('ic-cats-open', catsOpen);
    const toggle = button(
      'Categories and sound properties' + (filters.size ? ' · ' + filters.size + ' on' : ''),
      'categories',
      () =>
        change(
          () => {
            catsOpen = !catsOpen;
          },
          'categories',
          false
        ),
      { class: 'ic-cats-toggle', 'aria-expanded': catsOpen, 'aria-controls': 'ic-categories' }
    );
    const nav = el('nav', null, {
      id: 'ic-categories',
      class: 'ic-categories',
      'aria-label': 'Instrument categories and sound properties',
    });
    nav.append(el('h3', 'Categories' + (q || filters.size ? ' matching' : '')));
    function category(id, name, count) {
      const key = 'family:' + id;
      const b = button(
        name + ' · ' + count.toLocaleString('en'),
        key,
        () => change(() => familySelect(id), key),
        { 'aria-pressed': family === id, 'data-family': id, 'data-count-value': count }
      );
      if (!count) b.dataset.empty = 'true';
      return b;
    }
    nav.append(category('', 'All instruments', scope.length));
    for (const f of data.families)
      nav.append(category(f.id, f.name, scope.filter((i) => i.familyId === f.id).length));
    nav.append(
      el('h3', 'Sound properties'),
      el('p', 'An instrument must have every checked property. Numbers show how many would match.')
    );
    const clearFilters = () => {
      filters.clear();
      render();
      search.focus();
    };
    if (filters.size)
      nav.append(button('Clear sound properties', 'clear-properties', clearFilters));
    const groups = data.propertyGroups.map((g) => ({
      ...g,
      properties: data.properties.filter((p) => p.groupId === g.id),
    }));
    const known = new Set(data.propertyGroups.map((g) => g.id));
    const other = data.properties.filter((p) => !known.has(p.groupId));
    if (other.length) groups.push({ id: 'other', name: 'More properties', properties: other });
    for (const g of groups.filter((g) => g.properties.length)) {
      const details = el('details', null, { 'data-property-group': g.id });
      details.open = openGroups.has(g.id) || g.properties.some((p) => filters.has(p.id));
      details.addEventListener('toggle', () => {
        if (details.open) openGroups.add(g.id);
        else openGroups.delete(g.id);
      });
      const active = g.properties.filter((p) => filters.has(p.id)).length;
      details.append(el('summary', g.name + (active ? ' · ' + active + ' on' : '')));
      for (const p of g.properties) {
        const prospective = new Set(filters);
        prospective.add(p.id);
        const count = local.filter((i) => selected(i, prospective)).length;
        const line = el('label', null, { class: 'ic-check' });
        const input = el('input', null, {
          type: 'checkbox',
          'data-key': 'property:' + p.id,
          'data-property': p.id,
        });
        input.checked = filters.has(p.id);
        input.addEventListener('change', () =>
          change(() => {
            if (filters.has(p.id)) filters.delete(p.id);
            else filters.add(p.id);
            limit = 50;
          }, 'property:' + p.id)
        );
        line.append(
          input,
          el('span', p.label),
          el('span', String(count), { 'aria-label': count + ' matching', 'data-prospective': p.id })
        );
        details.append(line);
      }
      nav.append(details);
    }
    const list = el('section', null, { class: 'ic-results', 'aria-label': 'Instrument results' });
    const f = data.families.find((x) => x.id === family);
    const c = f?.classes.find((x) => x.id === cls);
    if (family)
      list.append(
        button(cls ? 'Back to ' + f.name : 'All instruments', 'back', () =>
          change(() => {
            if (cls) cls = '';
            else family = '';
          }, 'back')
        )
      );
    list.append(
      el('h3', c?.name || f?.name || 'All instruments', { tabindex: '-1' }),
      el(
        'p',
        filtered.length.toLocaleString('en') +
          ' ' +
          (filtered.length === 1 ? 'instrument' : 'instruments'),
        { 'data-count': '' }
      )
    );
    const controls = el('div', null, { class: 'ic-controls' });
    const sortLabel = el('label', 'Sort ');
    const select = el('select', null, { 'aria-label': 'Sort instruments', 'data-key': 'sort' });
    for (const s of data.sorts) select.append(el('option', s.name, { value: s.id }));
    select.value = sort;
    select.addEventListener('change', () =>
      change(
        () => {
          sort = select.value;
        },
        'sort',
        false
      )
    );
    sortLabel.append(select);
    controls.append(sortLabel);
    const views = el('div', null, { role: 'group', 'aria-label': 'Catalogue layout' });
    for (const v of ['rows', 'list'])
      views.append(
        button(
          v === 'rows' ? 'Rows' : 'List',
          'view:' + v,
          () =>
            change(
              () => {
                view = v;
                const saved = ctx.storage?.write('view', v);
                if (saved && !saved.ok) message('The layout changed, but could not be saved.');
              },
              'view:' + v,
              false
            ),
          { 'aria-pressed': view === v }
        )
      );
    controls.append(views);
    list.append(controls);
    if (f) {
      const chips = el('div', null, {
        role: 'group',
        'aria-label': f.name + ' classes',
        class: 'ic-classes',
      });
      const familyScope = scope.filter((i) => i.familyId === family);
      for (const cl of [{ id: '', name: 'All' }, ...f.classes]) {
        const count = familyScope.filter((i) => !cl.id || i.classId === cl.id).length;
        chips.append(
          button(
            cl.name + ' · ' + count,
            'class:' + cl.id,
            () =>
              change(() => {
                cls = cl.id;
                limit = 50;
              }, 'class:' + cl.id),
            { 'aria-pressed': cls === cl.id, 'data-class': cl.id }
          )
        );
      }
      list.append(chips);
    }
    if (filters.size) {
      const active = el('div', null, { 'aria-label': 'Sound properties in force' });
      for (const id of filters)
        active.append(
          button(
            'Remove ' + (data.properties.find((p) => p.id === id)?.label || id),
            'remove:' + id,
            () =>
              change(() => {
                filters.delete(id);
                limit = 50;
              }, 'property:' + id)
          )
        );
      active.append(button('Clear all', 'clear-all', clearFilters));
      list.append(active);
    }
    if (view === 'list') {
      const ul = el('ul', null, { class: 'ic-list', 'aria-label': 'Instruments' });
      for (const i of filtered.slice(0, limit)) ul.append(card(i));
      list.append(ul);
      if (filtered.length > limit) {
        list.append(
          el('p', 'Showing ' + limit + ' of ' + filtered.length),
          button('Show more', 'more', () =>
            change(
              () => {
                limit += 50;
              },
              'more',
              false
            )
          )
        );
      }
    } else {
      const best =
        q && sort === 'name' ? filtered.filter((i) => ranks.get(i.id) <= 2).slice(0, 12) : [];
      const bestIds = new Set(best.map((i) => i.id));
      const definitions = f ? f.classes : data.families;
      const keyOf = (i) => (f ? i.classId : i.familyId);
      const whole = data.items.filter((i) => !f || i.familyId === f.id);
      const rowGroups = definitions
        .map((g) => ({
          id: g.id,
          name: g.name,
          size: whole.filter((i) => keyOf(i) === g.id).length,
          items: filtered.filter((i) => keyOf(i) === g.id && !bestIds.has(i.id)),
        }))
        .sort(
          (a, b) => b.size - a.size || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
        );
      const nonempty = rowGroups.filter((g) => g.items.length);
      if (nonempty.length > 1) {
        const jump = el('nav', null, {
          class: 'ic-jump',
          'aria-label': f ? 'Jump to a ' + f.name + ' class' : 'Jump to a family',
        });
        for (const g of rowGroups) {
          const b = button(
            g.name,
            'jump:' + g.id,
            () => {
              const h = [...list.querySelectorAll('[data-group-heading]')].find(
                (n) => n.dataset.groupHeading === g.id
              );
              h?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
              h?.focus();
              const section = h?.closest('[data-group]');
              rowAim = section
                ? {
                    id: g.id,
                    below:
                      section.getBoundingClientRect().top - jump.getBoundingClientRect().bottom,
                  }
                : null;
              for (const x of jump.querySelectorAll('button')) x.removeAttribute('aria-current');
              b.setAttribute('aria-current', 'true');
            },
            { disabled: !g.items.length }
          );
          // Boolean attributes cannot be rendered as disabled="false".
          b.disabled = !g.items.length;
          jump.append(b);
        }
        list.append(jump);
      }
      for (const g of (best.length
        ? [{ id: 'best', name: 'Best matches', items: best }]
        : []
      ).concat(nonempty)) {
        const group = el('section', null, { class: 'ic-group', 'data-group': g.id });
        group.append(
          el('h4', g.name + ' · ' + g.items.length, { tabindex: '-1', 'data-group-heading': g.id })
        );
        const ul = el('ul', null, {
          class: 'ic-track',
          'aria-label': g.name + ' instruments',
          'data-track': g.id,
          'data-signature': JSON.stringify(g.items.map((i) => i.id)),
        });
        for (const i of g.items) ul.append(card(i));
        const previous = button(
          'Previous',
          'previous:' + g.id,
          () => ul.scrollBy?.({ left: -ul.clientWidth, behavior: 'auto' }),
          { 'aria-label': 'Previous ' + g.name + ' instruments' }
        );
        const next = button(
          'Next',
          'next:' + g.id,
          () => ul.scrollBy?.({ left: ul.clientWidth, behavior: 'auto' }),
          { 'aria-label': 'Next ' + g.name + ' instruments' }
        );
        const update = () => {
          previous.disabled = ul.scrollLeft <= 1;
          next.disabled = ul.scrollLeft + ul.clientWidth >= ul.scrollWidth - 1;
        };
        ul.addEventListener('scroll', update);
        group.append(previous, next, ul);
        list.append(group);
        const saved = positions.get(g.id);
        ul._icLeft = saved?.signature === ul.dataset.signature ? saved.left : 0;
        // Layout is available after insertion; ResizeObserver also handles reflow.
        ul._icUpdate = update;
      }
    }
    if (!filtered.length) {
      const empty = el('div', null, { class: 'ic-empty' });
      const why = [
        q && 'the search “' + query.trim() + '”',
        f && (c?.name || f.name),
        filters.size && filters.size + ' sound properties',
      ].filter(Boolean);
      const clashes = [],
        on = [...filters];
      for (let i = 0; i < on.length; i++)
        for (let j = i + 1; j < on.length; j++) {
          if (!data.items.some((x) => selected(x, new Set([on[i], on[j]]))))
            clashes.push(
              on
                .slice(i, i + 1)
                .concat(on[j])
                .map((id) => '“' + data.properties.find((p) => p.id === id)?.label + '”')
                .join(' and ')
            );
        }
      empty.append(
        el('h4', 'No instruments match'),
        el(
          'p',
          'Nothing satisfies ' +
            why.join(' and ') +
            ' together.' +
            (clashes.length
              ? ' No instrument in the catalogue is ' + clashes.join(', or ') + ' at once.'
              : '')
        )
      );
      if (q)
        empty.append(
          button('Clear search', 'clear-search', () => {
            query = '';
            search.value = '';
            limit = 50;
            render();
            search.focus();
          })
        );
      if (f)
        empty.append(
          button('All instruments', 'empty-all', () => change(() => familySelect(''), 'family:'))
        );
      list.append(empty);
    }
    body.append(toggle, nav, list);
    for (const track of body.querySelectorAll('[data-track]')) track.scrollLeft = track._icLeft;
    syncCurrentRow();
    for (const track of body.querySelectorAll('[data-track]')) track._icUpdate();
    syncRecipe();
    if (q)
      timer = setTimeout(() => {
        if (!disposed)
          ctx.announce?.(
            filtered.length.toLocaleString('en') +
              ' ' +
              (filtered.length === 1 ? 'instrument' : 'instruments')
          );
      }, 600);
  }
  function syncCurrentRow() {
    if (disposed) return;
    const jump = body.querySelector('.ic-jump');
    if (!jump) return;
    const buttons = [...jump.querySelectorAll('button')].filter((b) => !b.disabled);
    if (!jump.getClientRects().length) return;
    const edge = jump.getBoundingClientRect().bottom + 16;
    let current = buttons[0];
    for (const b of buttons) {
      const id = b.dataset.key.slice(5);
      const group = [...body.querySelectorAll('[data-group]')].find((g) => g.dataset.group === id);
      if (group?.getBoundingClientRect().top <= edge) current = b;
    }
    if (rowAim) {
      const group = [...body.querySelectorAll('[data-group]')].find(
        (g) => g.dataset.group === rowAim.id
      );
      const below =
        group && group.getBoundingClientRect().top - jump.getBoundingClientRect().bottom;
      const aimed = buttons.find((b) => b.dataset.key === 'jump:' + rowAim.id);
      if (aimed && group && Math.abs(below - rowAim.below) <= 1) current = aimed;
      else rowAim = null;
    }
    for (const b of buttons) {
      if (b === current) {
        if (b.getAttribute('aria-current') !== 'true') {
          b.setAttribute('aria-current', 'true');
          const box = b.getBoundingClientRect(),
            bar = jump.getBoundingClientRect();
          if (box.left < bar.left || box.right > bar.right)
            jump.scrollLeft += box.left - bar.left - (jump.clientWidth - b.offsetWidth) / 2;
        }
      } else b.removeAttribute('aria-current');
    }
  }
  // Scoped geometry tracking also sees shell-ancestor scroll, without installing
  // document/window listeners. Hidden lanes skip measurements; teardown cancels it.
  function followRows() {
    if (disposed) return;
    if (view === 'rows' && root.getClientRects().length) syncCurrentRow();
    rowFrame = requestAnimationFrame(followRows);
  }
  if (typeof requestAnimationFrame === 'function') rowFrame = requestAnimationFrame(followRows);
  body.addEventListener('scroll', syncCurrentRow, true);
  const resize =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          for (const t of body.querySelectorAll('[data-track]')) t._icUpdate();
          syncCurrentRow();
        })
      : null;
  resize?.observe(body);
  search.addEventListener('input', () => {
    query = search.value;
    limit = 50;
    render();
  });
  search.addEventListener('keydown', (e) => {
    if (
      !['ArrowDown', 'Enter'].includes(e.key) ||
      e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      e.shiftKey ||
      e.isComposing ||
      !search.value.trim()
    )
      return;
    const first = [...body.querySelectorAll('[data-open]')].find(
      (b) => !b.disabled && b.getClientRects().length
    );
    if (first) {
      e.preventDefault();
      first.focus();
    }
  });
  async function load(retry = false) {
    controller?.abort();
    controller = new AbortController();
    const ticket = ++sequence;
    clearTimeout(timer);
    data = null;
    search.disabled = true;
    body.replaceChildren(el('p', 'Loading the instruments…', { role: 'status', tabindex: '-1' }));
    if (retry) body.firstElementChild.focus();
    try {
      const next = await ctx.loadInstrumentCatalog({ signal: controller.signal });
      if (disposed || ticket !== sequence) return;
      data = next;
      query = '';
      search.value = '';
      family = '';
      cls = '';
      sort = 'name';
      limit = 50;
      filters = new Set();
      openGroups = new Set(['behaviour', 'voicing', 'pitch']);
      catsOpen = false;
      search.disabled = false;
      render();
      if (retry) search.focus();
    } catch (e) {
      if (disposed || ticket !== sequence || e.name === 'AbortError') return;
      const error = el(
        'p',
        e.message ||
          'This instrument’s details couldn’t load. Check your connection, then try again.',
        { role: 'status' }
      );
      const retryButton = button('Retry', 'retry', () => load(true));
      body.replaceChildren(error, retryButton);
      if (retry) retryButton.focus();
    }
  }
  const offRecipe = ctx.recipe?.subscribe?.(syncRecipe);
  const offSelection = ctx.instrument?.subscribe?.(() => {
    for (const n of body.querySelectorAll('[data-item]')) {
      if (n.dataset.item === ctx.instrument.current()) n.setAttribute('aria-current', 'true');
      else n.removeAttribute('aria-current');
    }
  });
  function unmount() {
    if (disposed) return;
    disposed = true;
    sequence++;
    clearTimeout(timer);
    controller?.abort();
    resize?.disconnect();
    if (rowFrame) cancelAnimationFrame(rowFrame);

    offRecipe?.();
    offSelection?.();
    ctx.signal?.removeEventListener('abort', unmount);
    root.remove();
    css.remove();
  }
  ctx.signal?.addEventListener('abort', unmount, { once: true });
  if (ctx.signal?.aborted) unmount();
  else load();
  return {
    unmount,
    focus: () => {
      if (!disposed) (search.disabled ? heading : search).focus();
    },
  };
}

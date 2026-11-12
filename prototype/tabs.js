// Manually activated tabs: arrows/Home/End move between tabs; click, Enter
// or Space selects. Each lane loads on first selection and stays mounted.
export function createTabs(panel, lanes, createHost) {
  const doc = panel.ownerDocument;
  const root = doc.createElement('section');
  root.setAttribute('aria-label', 'Instrument configuration');
  const list = doc.createElement('div');
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-label', 'Instrument configuration');
  root.append(list);
  let active = 0;
  let shown = false;
  let disposed = false;
  const life = new AbortController();
  const entries = lanes.map((lane, i) => {
    const tab = doc.createElement('button');
    tab.type = 'button';
    tab.id = `proto-tab-${lane.id}`;
    tab.setAttribute('role', 'tab');
    tab.textContent = lane.tab;
    const region = doc.createElement('section');
    region.id = `proto-panel-${lane.id}`;
    region.setAttribute('role', 'tabpanel');
    region.setAttribute('aria-labelledby', tab.id);
    region.tabIndex = 0;
    tab.setAttribute('aria-controls', region.id);
    list.append(tab);
    root.append(region);
    const host = createHost(lane, region);
    tab.addEventListener('click', () => select(i), { signal: life.signal });
    tab.addEventListener(
      'keydown',
      (event) => {
        let next;
        if (event.key === 'ArrowRight') next = (i + 1) % lanes.length;
        if (event.key === 'ArrowLeft') next = (i + lanes.length - 1) % lanes.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = lanes.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        entries.forEach((entry, j) => {
          entry.tab.tabIndex = j === next ? 0 : -1;
        });
        entries[next].tab.focus();
      },
      { signal: life.signal }
    );
    return { tab, region, host };
  });
  function paint() {
    entries.forEach(({ tab, region }, i) => {
      tab.setAttribute('aria-selected', String(active === i));
      tab.tabIndex = active === i ? 0 : -1;
      region.hidden = active !== i;
    });
  }
  function select(index) {
    if (disposed) return;
    active = index;
    paint();
    if (shown) void entries[active].host.show();
  }
  paint();
  panel.append(root);
  return {
    root,
    show() {
      if (disposed) return;
      shown = true;
      void entries[active].host.show();
    },
    unmount() {
      disposed = true;
      life.abort();
      try {
        const errors = [];
        for (const { host } of entries) {
          try {
            host.unmount();
          } catch (error) {
            errors.push(error);
          }
        }
        if (errors.length) throw new AggregateError(errors, 'Tabs did not end cleanly.');
      } finally {
        root.remove();
      }
    },
  };
}

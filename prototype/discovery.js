// The Genre page's discovery state (#668 6665493327): the taxonomy the
// Categories lane browses, the Find a sound targets, the narrow disclosure
// both share, and the ranked results the shell lists. One store, so a count
// always equals its list and a target always narrows the same results.
//
// Everything here is production's rule, read from src/pages/genre.js on main
// d022ec589d: gpMembership (counts), gpBrowse (roots, branch, children),
// gpFindSound / gpAxisControl (axes, labels), gpResults (the within-one-step
// filter and its order) and the genre-* actions. The data are the files the
// lazy page reads: api/browse_boot.json (parent, crossRefs, axes) and the
// page's own tables through prototype/engine/load.js (TREE_NODES, the glyphs,
// AXIS_DEFINITIONS, axisLabel). scripts/check_prototype_hosts.js holds every
// count, order, glyph and result to codex.html's own.
//
// Snapshots are frozen; every command takes the revision it read and is
// refused STALE when it changed, BUSY while the data load. The shell, not a
// lane, announces (host.js announce).

const FEATURED = ['soundTech', 'density', 'voice'];
const ROOTS_SHOWN = 10;
const SVG_NS = 'http://www.w3.org/2000/svg';
const byName = new Intl.Collator('en', { sensitivity: 'base' }).compare;
// workbench.js uiCount: 1,234 genres / 1 genre.
export const countOf = (n, one, many = one + 's') =>
  n.toLocaleString('en') + ' ' + (n === 1 ? one : many);

const fail = (code, message) => Object.assign(new Error(message), { code });
const STALE = () => fail('STALE', 'That view changed before the action ran. Try it again.');
const BUSY = () => fail('BUSY', 'The genres are still loading.');

function freeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) freeze(x);
  }
  return v;
}

// One subscribable snapshot.
function cell(initial) {
  let value = freeze(initial);
  const listeners = new Set();
  return {
    current: () => value,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set(next) {
      value = freeze(next);
      for (const fn of [...listeners]) fn(value);
    },
  };
}

const glyphUrl = (svg) =>
  `data:image/svg+xml,${encodeURIComponent(svg.replace('<svg ', `<svg xmlns="${SVG_NS}" `))}`;

// production's gpMembership: every taxonomy node a tradition belongs to, by
// its primary parent's chain and every cross-reference's chain.
export function membership(items, nodes) {
  const chains = new Map();
  const chain = (nid) => {
    if (!nid) return [];
    if (chains.has(nid)) return chains.get(nid);
    const out = [];
    const seen = new Set();
    for (let p = nid; p && !seen.has(p); ) {
      seen.add(p);
      const node = nodes.get(p);
      if (!node) break;
      out.push(p);
      p = node.parent;
    }
    chains.set(nid, out);
    return out;
  };
  const byTrad = new Map();
  const count = new Map();
  const cross = new Map();
  for (const t of items) {
    const primary = new Set(chain(t.parent || null));
    const all = new Set(primary);
    for (const x of t.crossRefs || []) for (const n of chain(x)) all.add(n);
    byTrad.set(t.id, all);
    for (const n of all) {
      count.set(n, (count.get(n) || 0) + 1);
      if (!primary.has(n)) cross.set(n, (cross.get(n) || 0) + 1);
    }
  }
  return { byTrad, count, cross };
}

// production's gpResults with no search: the branch keeps its members
// (cross-listed included); targets keep genres within one step of every
// target, a missing value counted as 0, and rank by total distance; ties A–Z.
export function rank(items, { branch, targets, members }) {
  let rows = items.slice().sort((a, b) => byName(a.name, b.name));
  if (branch) rows = rows.filter((t) => members.byTrad.get(t.id)?.has(branch));
  const pairs = Object.entries(targets);
  if (!pairs.length) return rows.map((t) => ({ t, dist: 0 }));
  return rows
    .map((t) => {
      let dist = 0;
      let within = true;
      for (const [k, v] of pairs) {
        const d = Math.abs((t.axes[k] ?? 0) - v);
        dist += d;
        if (d > 1) within = false;
      }
      return { t, dist, within };
    })
    .filter((r) => r.within)
    .sort((a, b) => a.dist - b.dist || byName(a.t.name, b.t.name));
}

// load() resolves { items, page }: the boot items (axes as an object by
// axisKeys) and the page tables. select(id) opens a genre (selection.js).
export function genreDiscovery({ load, select, announce }) {
  let data = null;
  let failure = null;
  let loading = null;
  const state = { branch: null, allRoots: false, targets: {}, allAxes: false, open: false };
  const rev = { categories: 0, targets: 0, discovery: 0 };
  let narrow = false;

  const categories = cell({ status: 'loading', error: null, revision: 0 });
  const targets = cell({ status: 'loading', error: null, revision: 0 });
  const discovery = cell({ open: false, narrow: false, revision: 0 });
  const results = cell({ status: 'loading', count: 0, rows: [], line: '', best: null });

  const node = (id) => {
    const n = data.nodes.get(id);
    const r = data.page.resolveTraditionGlyphs(id, data.byId);
    const glyphs = [];
    for (const [ch, kind] of [
      [r.fn, 'fn'],
      [r.second, r.secondKind || 'region'],
    ]) {
      const svg = ch ? data.page.glyphSvg(ch, 22) : '';
      if (svg)
        glyphs.push({ url: glyphUrl(svg), label: data.page.GLYPH_META[ch]?.label || '', kind });
    }
    return { id, name: n.name, count: data.members.count.get(id) || 0, glyphs };
  };

  function publish(which) {
    if (!data) {
      const s = failure
        ? { status: 'error', error: { code: failure.code, message: failure.message } }
        : { status: 'loading', error: null };
      categories.set({ ...s, revision: rev.categories });
      targets.set({ ...s, revision: rev.targets });
      results.set({ status: s.status, count: 0, rows: [], line: '', best: null });
      return;
    }
    const ranked = rank(data.items, {
      branch: state.branch,
      targets: state.targets,
      members: data.members,
    });
    const b = state.branch && data.nodes.get(state.branch);
    const order = Object.keys(state.targets).length
      ? ' · closest to your sound targets first'
      : ' · A to Z';
    const lead = countOf(ranked.length, 'genre') + (b ? ' in ' + b.name : '');
    results.set({
      status: 'ready',
      count: ranked.length,
      rows: ranked.map((r) => ({ id: r.t.id, name: r.t.name })),
      lead,
      line: lead + (ranked.length ? order : ''),
      best: ranked[0] ? { id: ranked[0].t.id, name: ranked[0].t.name } : null,
    });
    if (!which || which === 'categories') {
      const branch = b
        ? {
            node: node(b.id),
            parent:
              b.parent && data.nodes.get(b.parent)
                ? { id: b.parent, name: data.nodes.get(b.parent).name }
                : null,
            cross: data.members.cross.get(b.id) || 0,
            children: data.tree.filter((n) => n.parent === b.id).map((n) => node(n.id)),
          }
        : null;
      categories.set({
        status: 'ready',
        error: null,
        revision: rev.categories,
        total: data.items.length,
        allRoots: state.allRoots,
        rootCount: data.roots.length,
        rootsShown: ROOTS_SHOWN,
        roots: data.roots.map((n) => node(n.id)),
        branch,
      });
    }
    const axisRank = (ax) => {
      const i = FEATURED.indexOf(ax.id);
      return i < 0 ? FEATURED.length : i;
    };
    const axes = data.page.AXIS_DEFINITIONS.map((ax) => ({
      id: ax.id,
      name: ax.name,
      neg: ax.neg,
      pos: ax.pos,
    }));
    const applied = data.page.AXIS_DEFINITIONS.filter((ax) => ax.id in state.targets).map((ax) => ({
      axis: ax.id,
      value: state.targets[ax.id],
      label: data.page.axisLabel(ax, state.targets[ax.id]),
    }));
    targets.set({
      status: 'ready',
      error: null,
      revision: rev.targets,
      axes: axes.slice().sort((a, b) => axisRank(a) - axisRank(b)),
      featured: FEATURED,
      allAxes: state.allAxes,
      targets: applied,
      applied: applied.length,
      results: { count: ranked.length, best: results.current().best },
    });
  }

  function start() {
    if (!loading)
      loading = Promise.resolve()
        .then(load)
        .then(({ items, page }) => {
          const tree = page.TREE_NODES.map((n) => ({ id: n.id, name: n.name, parent: n.parent }));
          const byId = Object.fromEntries(page.TREE_NODES.map((n) => [n.id, n]));
          const nodes = new Map(tree.map((n) => [n.id, n]));
          data = {
            items,
            page,
            tree,
            byId,
            nodes,
            roots: tree.filter((n) => n.parent === null),
            members: membership(items, nodes),
          };
          failure = null;
          publish();
        })
        .catch((e) => {
          loading = null;
          failure = {
            code: 'LOAD_FAILED',
            message: 'The genres couldn’t load. Check your connection, then try again.',
          };
          void e;
          publish();
        });
    return loading;
  }

  const guard = (which, revision) => {
    if (!data) throw BUSY();
    if (revision !== rev[which]) throw STALE();
  };
  const bump = (...which) => {
    for (const w of which) rev[w]++;
    publish();
    return { revision: rev[which[0]] };
  };

  // Production speaks once a change settles, and never the same sentence
  // twice in a row (gpSoundAnnounceSoon).
  let timer = 0;
  let said = '';
  const settle = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const n = Object.keys(state.targets).length;
      const count = results.current().lead || '';
      const text = n
        ? `${countOf(n, 'target')} applied.${count ? ' ' + count + '.' : ''}`
        : `Sound targets cleared.${count ? ' ' + count + '.' : ''}`;
      if (text === said) return;
      said = text;
      announce(text);
    }, 500);
  };

  let focusCount = () => {};
  let focusToggle = () => {};

  const categoryCommands = {
    async openBranch(id, revision) {
      guard('categories', revision);
      if (!data.nodes.has(id)) throw fail('NOT_FOUND', 'That category isn’t in the catalog.');
      state.branch = id;
      select(null);
      const r = bump('categories', 'targets');
      focusCount();
      return r;
    },
    async back(revision) {
      guard('categories', revision);
      const b = state.branch && data.nodes.get(state.branch);
      state.branch = (b && b.parent) || null;
      return bump('categories', 'targets');
    },
    async allGenres(revision) {
      guard('categories', revision);
      state.branch = null;
      select(null);
      return bump('categories', 'targets');
    },
    async toggleRoots(revision) {
      guard('categories', revision);
      state.allRoots = !state.allRoots;
      return bump('categories');
    },
  };

  const axisOf = (id) => data.page.AXIS_DEFINITIONS.find((a) => a.id === id);
  const targetCommands = {
    async apply(axis, value, revision) {
      guard('targets', revision);
      if (!axisOf(axis)) throw fail('BAD_AXIS', 'That sound characteristic isn’t one of the 13.');
      if (!Number.isInteger(value) || value < -2 || value > 2)
        throw fail('BAD_VALUE', 'A sound target is a whole step from −2 to 2.');
      state.targets = { ...state.targets, [axis]: value };
      const r = bump('targets', 'categories');
      settle();
      return r;
    },
    async clear(axis, revision) {
      guard('targets', revision);
      if (!(axis in state.targets)) throw fail('NOT_APPLIED', 'That target isn’t applied.');
      const next = { ...state.targets };
      delete next[axis];
      state.targets = next;
      const r = bump('targets', 'categories');
      settle();
      return r;
    },
    async reset(revision) {
      guard('targets', revision);
      state.targets = {};
      const r = bump('targets', 'categories');
      settle();
      return r;
    },
    async toggleAll(revision) {
      guard('targets', revision);
      state.allAxes = !state.allAxes;
      return bump('targets');
    },
    async match(revision) {
      guard('targets', revision);
      const best = results.current().best;
      if (best) select(best.id);
      else focusCount();
      return { revision: rev.targets };
    },
    // Row 171, from a genre's Sound profile or Similar sounds (#767).
    async useProfile(genreId) {
      if (!data) throw BUSY();
      const t = data.items.find((x) => x.id === genreId);
      if (!t) throw fail('NOT_FOUND', 'That genre isn’t in the catalog.');
      const next = {};
      for (const ax of data.page.AXIS_DEFINITIONS) next[ax.id] = t.axes[ax.id] ?? 0;
      state.targets = next;
      state.allAxes = true;
      state.branch = null;
      select(null);
      const r = bump('targets', 'categories');
      announce(`Sound targets set from ${t.name}’s profile`);
      focusCount();
      return r;
    },
  };

  const discoveryCommands = {
    async setOpen(open, revision) {
      if (revision !== rev.discovery) throw STALE();
      state.open = !!open;
      rev.discovery++;
      discovery.set({ open: state.open, narrow, revision: rev.discovery });
      return { revision: rev.discovery };
    },
    focusToggle: () => focusToggle(),
  };

  const view = (c, commands) =>
    Object.freeze({ current: c.current, subscribe: c.subscribe, ...commands });

  return {
    start,
    results: Object.freeze({ current: results.current, subscribe: results.subscribe }),
    categories: view(categories, categoryCommands),
    targets: view(targets, targetCommands),
    discovery: view(discovery, discoveryCommands),
    // The shell's: where focus goes after a branch or a match, and the width.
    setFocusCount(fn) {
      focusCount = fn;
    },
    setFocusToggle(fn) {
      focusToggle = fn;
    },
    setNarrow(next) {
      if (next === narrow) return;
      narrow = next;
      rev.discovery++;
      discovery.set({ open: state.open, narrow, revision: rev.discovery });
    },
  };
}

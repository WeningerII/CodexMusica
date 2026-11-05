'use strict';
// Source/contract checks with real merged Oud catalog and canonical engine.
// The small DOM double below is NOT a browser or accessibility validation.
// Descriptor oracle executes production rendering/normalization source unchanged.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../../..');
const sourcePath =
  process.env.PARTS_SOURCE ||
  path.join(root, 'prototype/features/instrument-configuration/parts.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const blob = (text) =>
  crypto
    .createHash('sha1')
    .update(`blob ${Buffer.byteLength(text)}\0`)
    .update(text)
    .digest('hex');
for (const [file, expected] of [
  ['src/pages/instrument.js', '8e6e3df0ed3cefc9cff11b04ac9815e775904517'],
  ['src/app.js', 'c363423cee3f6c8340d2ca0a1ebcfe0f318e3a38'],
  ['scripts/_loader.js', '7c8b0a104617b019d60b63aa16b45062c6872fff'],
  ['scripts/_merge.js', '971a36572bc8497d1033d7628d4826b22739d6a6'],
])
  assert.equal(
    blob(fs.readFileSync(path.join(root, file), 'utf8')),
    expected,
    `source provenance: ${file}`
  );
const db = require(path.join(root, 'scripts/_loader.js'));
const engine = require(path.join(root, 'scripts/_load_app.js')).loadApp();
const instrument = db.INSTRUMENTS.find((i) => i.id === 'oud');
const card = engine.makeCard('oud', engine.traditionCardOpts('bluegrass', 'oud'));
const appSource = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const descriptorSource = appSource.slice(
  appSource.indexOf('const DESCRIPTOR_FILLERS ='),
  appSource.indexOf('// ---- Stack compilation (on demand) ----')
);
const entryRenderDescs = new Function(`${descriptorSource}; return entryRenderDescs;`)();
const normalizeSource = appSource.slice(
  appSource.indexOf('function normalizeSearch(s)'),
  appSource.indexOf('// How well a normalized query matches')
);
const normalizeSearch = new Function(`${normalizeSource}; return normalizeSearch;`)();
const inspectorSource = fs.readFileSync(path.join(root, 'src/pages/instrument.js'), 'utf8');
const optionSource = inspectorSource.slice(
  inspectorSource.indexOf('function ipOptionDescs('),
  inspectorSource.indexOf('function ipOption(')
);
const esc = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const productionOption = new Function(
  'entryRenderDescs',
  'esc',
  `${optionSource}; return ipOptionDescs;`
)(entryRenderDescs, esc);
function oracle(candidate, current) {
  const dom = new JSDOM(productionOption(candidate, current));
  return [...dom.window.document.querySelectorAll('.ip-d')].map((n) => ({
    type: n.classList.contains('ip-d-lost')
      ? 'removes'
      : n.classList.contains('ip-d-add')
        ? 'adds'
        : 'kept',
    text: n.lastChild.textContent,
  }));
}
const projection = () =>
  instrument.parts.map((p) => ({
    id: p.id,
    name: p.name,
    value: card.parts[p.id] || null,
    pinned: card.pinnedParts?.includes(p.id) || false,
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      expanded: v.expanded,
      alias_of: v.alias_of,
      descriptors: entryRenderDescs(v),
    })),
  }));
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
// Intentionally small host-local DOM model. It does not simulate keyboard,
// radio grouping, layout, focus loss on removal, or the accessibility tree.
class Element {
  constructor(tag, doc) {
    this.tagName = tag;
    this.ownerDocument = doc;
    this.children = [];
    this.dataset = {};
    this.attrs = {};
    this.listeners = new Map();
    this.textContent = '';
  }
  append(...nodes) {
    for (const n of nodes) {
      n.parentElement = this;
      this.children.push(n);
    }
  }
  replaceChildren(...nodes) {
    this.children.forEach((n) => {
      n.parentElement = null;
    });
    this.children = [];
    this.append(...nodes);
  }
  remove() {
    if (this.parentElement)
      this.parentElement.children = this.parentElement.children.filter((n) => n !== this);
    this.parentElement = null;
  }
  contains(node) {
    return node === this || this.children.some((n) => n.contains(node));
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  addEventListener(k, fn) {
    if (!this.listeners.has(k)) this.listeners.set(k, new Set());
    this.listeners.get(k).add(fn);
  }
  removeEventListener(k, fn) {
    this.listeners.get(k)?.delete(fn);
  }
  matches(s) {
    if (s === '[data-key]') return this.dataset.key != null;
    if (s === 'button[data-action]') return this.tagName === 'button' && !!this.dataset.action;
    if (s === 'input[type="radio"]') return this.tagName === 'input' && this.type === 'radio';
    if (s === 'input[type="radio"][data-part]')
      return this.matches('input[type="radio"]') && !!this.dataset.part;
    return false;
  }
  closest(s) {
    return this.matches(s) ? this : this.parentElement?.closest(s);
  }
  querySelectorAll(s) {
    return this.children.flatMap((n) => [...(n.matches(s) ? [n] : []), ...n.querySelectorAll(s)]);
  }
  focus() {
    this.ownerDocument.activeElement = this;
  }
  async fire(type, target) {
    await Promise.all([...(this.listeners.get(type) || [])].map((fn) => fn({ target })));
  }
}
const doc = {
  activeElement: null,
  createElement(tag) {
    return new Element(tag, this);
  },
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function run() {
  const { mount } = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  );
  let snapshot = freeze({
    status: 'loading',
    error: null,
    instrumentId: 'oud',
    revision: 0,
    parts: [],
    note: null,
  });
  const listeners = new Set(),
    calls = [],
    messages = [],
    actions = [];
  const adapter = {
    snapshot: () => snapshot,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    choosePart(op) {
      calls.push(op);
      return new Promise((resolve, reject) => actions.push({ resolve, reject }));
    },
  };
  const push = (patch) => {
    snapshot = freeze({ ...snapshot, ...patch });
    [...listeners].forEach((fn) => fn());
  };
  const host = doc.createElement('main'),
    signal = new AbortController();
  const handle = mount(host, {
    signal: signal.signal,
    configuration: adapter,
    announce: (s) => messages.push(s),
  });
  const panel = host.children[0];
  assert.equal(panel.attrs['aria-busy'], 'true');
  push({ status: 'error', error: { code: 'LOAD', message: 'Exact supplied load error' } });
  assert.equal(panel.children[0].textContent, 'Exact supplied load error');
  assert.equal(messages.filter((m) => m === 'Exact supplied load error').length, 1);
  push({ status: 'ready', error: null, revision: 1, parts: projection() });
  assert(
    panel.querySelectorAll('input[type="radio"]').length > 0,
    'first part opens after loading'
  );
  const find = (kind, part, variant) =>
    panel
      .querySelectorAll('[data-key]')
      .find(
        (n) =>
          n.dataset.key === JSON.stringify(kind === 'option' ? [kind, part, variant] : [kind, part])
      );
  const technique = 'plucked_traditional_technique';
  const first = find('option', technique, 'plucked_classical_idiom');
  first.focus();
  const changing = panel.fire('change', first);
  assert.deepEqual(calls[0], {
    partId: technique,
    variantId: 'plucked_classical_idiom',
    revision: 1,
  });
  const second = find('option', technique, '');
  second.checked = true;
  await panel.fire('change', second);
  assert.equal(calls.length, 1, 'pending action is not duplicated');
  assert.equal(
    find('option', technique, '').checked,
    card.parts[technique] == null,
    'pending optimistic choice restored'
  );
  const env = JSON.stringify([card.room, card.tuning, card.chain]);
  card.parts[technique] = calls[0].variantId;
  assert.equal(engine.applyPartEdit(card, technique, { quiet: true }), false);
  push({ revision: 2, parts: projection(), note: 'Exact supplied collateral note' });
  actions[0].resolve(snapshot);
  await changing;
  assert.equal(messages.filter((m) => m === 'Exact supplied collateral note').length, 1);
  assert(find('option', technique, 'plucked_classical_idiom').checked);
  await panel.fire('click', find('part', 'oud_body_wood'));
  assert.equal(
    find('more', 'oud_body_wood').textContent,
    'More materials — any wood on any instrument (582)'
  );
  await panel.fire('click', find('more', 'oud_body_wood'));
  const expanded = instrument.parts
    .find((p) => p.id === 'oud_body_wood')
    .variants.filter((v) => v.expanded && !v.alias_of);
  const visible = panel
    .querySelectorAll('input[type="radio"]')
    .filter((r) => r.dataset.part === 'oud_body_wood');
  assert.deepEqual(
    visible.slice(6).map((r) => r.dataset.variant),
    expanded.map((v) => v.id),
    'expanded order and aliases'
  );
  const materialChange = panel.fire(
    'change',
    find('option', 'oud_body_wood', 'archtop_carved_spruce')
  );
  assert.equal(calls[1].revision, 2);
  card.parts.oud_body_wood = 'archtop_carved_spruce';
  assert.equal(engine.applyPartEdit(card, 'oud_body_wood', { quiet: true }), true);
  assert.equal(card.parts[technique], 'plucked_classical_idiom');
  assert.equal(JSON.stringify([card.room, card.tuning, card.chain]), env);
  push({ revision: 3, parts: projection(), note: null });
  actions[1].resolve(snapshot);
  await materialChange;
  const clearing = panel.fire('change', find('option', 'oud_body_wood', ''));
  assert.equal(calls[2].variantId, null);
  card.parts.oud_body_wood = null;
  engine.applyPartEdit(card, 'oud_body_wood', { quiet: true });
  push({ revision: 4, parts: projection() });
  actions[2].resolve(snapshot);
  await clearing;
  assert(find('option', 'oud_body_wood', '').checked);
  const alias = instrument.parts
    .find((p) => p.id === 'oud_body_wood')
    .variants.find((v) => v.alias_of);
  card.parts.oud_body_wood = alias.id;
  push({ revision: 5, parts: projection() });
  assert(find('more', 'oud_body_wood').textContent.endsWith('(583)'));
  assert(find('option', 'oud_body_wood', alias.id).checked);
  const otherHost = doc.createElement('aside'),
    otherSignal = new AbortController();
  const other = mount(otherHost, {
    signal: otherSignal.signal,
    configuration: adapter,
    announce: () => {},
  });
  const name1 = find('option', technique, '').name;
  const name2 = otherHost.querySelectorAll('input[type="radio"]')[0].name;
  assert(name1 && name2 && name1 !== name2, 'mount-unique native radio names');
  assert.equal(
    new Set(visible.map((r) => r.name)).size,
    1,
    'one radio name across native and borrowed'
  );
  const stale = panel.fire('change', find('option', technique, ''));
  push({ revision: 6, instrumentId: 'voice', parts: [] });
  actions[3].reject(Object.assign(new Error('old selection error'), { code: 'STALE' }));
  await stale;
  assert(!messages.includes('old selection error'));
  push({ revision: 7, instrumentId: 'oud', parts: projection() });
  const rejected = panel.fire('change', find('option', technique, ''));
  actions[4].reject(
    Object.assign(new Error('<b>Exact safe supplied error</b>'), { code: 'STALE' })
  );
  await rejected;
  assert(messages.includes('<b>Exact safe supplied error</b>'));
  assert.equal(panel.children[0].textContent, '<b>Exact safe supplied error</b>');
  const late = panel.fire('change', find('option', technique, ''));
  const old = snapshot;
  push({ revision: 8, parts: projection(), note: 'Latest revision note' });
  actions[5].resolve(old);
  await late;
  assert.equal(
    panel.children[0].textContent,
    'Latest revision note',
    'late result cannot regress snapshot'
  );
  const afterAbort = panel.fire('change', find('option', technique, ''));
  signal.abort();
  const count = messages.length;
  actions[6].reject(new Error('late after abort'));
  await afterAbort;
  assert.equal(host.children.length, 0);
  assert.equal(messages.length, count);
  assert.equal(listeners.size, 1);
  handle.unmount();
  other.unmount();
  other.unmount();
  assert.equal(listeners.size, 0);
  assert.equal(engine.app.cards.length, 0);
  await descriptorChecks(mount);
  await tick();
  console.log(
    'PASS source/contract: real Oud options, two engine branches, null, alias, pins/environment, delayed replies, errors, multiple hosts, abort/disposal.'
  );
  console.log(
    'Browser/AT/layout and shared-adapter integration require separate qualification. Rows 199–200 remain pending.'
  );
}

async function descriptorChecks(mount) {
  const descendants = (n) => n.children.flatMap((c) => [c, ...descendants(c)]);
  let state = freeze({
    status: 'ready',
    error: null,
    instrumentId: 'oud',
    revision: 1,
    parts: projection(),
    note: null,
  });
  const callbacks = new Set();
  const messages = [];
  const host = doc.createElement('main');
  const controller = new AbortController();
  const handle = mount(host, {
    signal: controller.signal,
    announce: (m) => messages.push(m),
    configuration: {
      snapshot: () => state,
      subscribe(fn) {
        callbacks.add(fn);
        return () => callbacks.delete(fn);
      },
      choosePart() {
        throw new Error('filtering must never choose');
      },
    },
  });
  const panel = host.children[0];
  const all = () => descendants(panel);
  const button = (action, id) =>
    all().find((n) => n.dataset.action === action && n.dataset.part === id);
  const input = (kind, id) => all().find((n) => n.dataset.filter === JSON.stringify([kind, id]));
  function checkDeltas(part) {
    const current = part.variants.find(
      (v) => v.id === state.parts.find((p) => p.id === part.id).value
    );
    for (const radio of panel
      .querySelectorAll('input[type="radio"]')
      .filter((r) => r.dataset.part === part.id)) {
      const candidate = part.variants.find((v) => v.id === radio.dataset.variant) || null;
      const deltas = descendants(radio.parentElement)
        .filter((n) => n.dataset.delta)
        .map((n) => ({ type: n.dataset.delta, text: n.dataset.descriptor }));
      assert.deepEqual(
        deltas,
        oracle(candidate, current),
        `production delta oracle ${part.id}/${candidate?.id || 'null'}`
      );
      const name = all().find((n) => n.id === radio.attrs['aria-labelledby']);
      const desc = all().find((n) => n.id === radio.attrs['aria-describedby']);
      assert(name && desc && name !== desc, 'radio name separate from described delta');
      assert.equal(name.textContent, candidate?.name || 'Not set');
    }
  }
  const wood = instrument.parts.find((p) => p.id === 'oud_body_wood');
  await panel.fire('click', button('part', wood.id));
  await panel.fire('click', button('more', wood.id));
  checkDeltas(wood);
  const search = input('more', wood.id);
  assert(search, 'material search exists (fails prior partial implementation)');
  const own = (v) => normalizeSearch([v.name || v.id, ...entryRenderDescs(v)].join(' '));
  for (const query of ['spruce', 'CARVED—SOLID', '  ébony ', 'not-a-real-material-zzzz']) {
    search.value = query;
    search.focus();
    await panel.fire('input', search);
    const options = panel
      .querySelectorAll('input[type="radio"]')
      .filter(
        (r) =>
          r.dataset.part === wood.id &&
          wood.variants.find((v) => v.id === r.dataset.variant)?.expanded
      );
    for (const radio of options) {
      const v = wood.variants.find((v) => v.id === radio.dataset.variant);
      assert.equal(
        !!radio.parentElement.hidden,
        !own(v).includes(normalizeSearch(query)),
        'candidate-only normalized material match'
      );
    }
    assert.equal(doc.activeElement, search, 'typing retains the same input');
    assert(messages.at(-1).includes('match'));
  }
  // Exercise an actual native list above the threshold and a real 10-option boundary.
  for (const [length, expectedFilter] of [
    [10, false],
    [11, true],
  ]) {
    const inst = db.INSTRUMENTS.find((i) =>
      i.parts.some((p) => p.variants.filter((v) => !v.expanded).length === length)
    );
    assert(inst, `real ${length}-option fixture`);
    const part = inst.parts.find((p) => p.variants.filter((v) => !v.expanded).length === length);
    state = freeze({
      ...state,
      instrumentId: inst.id,
      revision: state.revision + 1,
      parts: [
        {
          id: part.id,
          name: part.name,
          value: part.variants[0].id,
          pinned: false,
          variants: part.variants.map((v) => ({ ...v, descriptors: entryRenderDescs(v) })),
        },
      ],
    });
    callbacks.forEach((fn) => fn());
    assert.equal(!!input('native', part.id), expectedFilter, `native filter threshold ${length}`);
    checkDeltas(part);
    if (expectedFilter) {
      const nativeSearch = input('native', part.id);
      const current = part.variants[0];
      const pair = part.variants
        .filter((v) => !v.expanded)
        .flatMap((v) =>
          entryRenderDescs(current)
            .filter((d) => !own(v).includes(normalizeSearch(d)))
            .map((d) => ({ v, d }))
        )[0];
      assert(pair, 'real removed-only descriptor query');
      nativeSearch.value = pair.d;
      await panel.fire('input', nativeSearch);
      const options = panel.querySelectorAll('input[type="radio"]');
      assert(
        options.find((r) => r.dataset.variant === pair.v.id).parentElement.hidden,
        'removed descriptors never count as candidate search text'
      );
      assert(
        !options.find((r) => r.dataset.variant === '').parentElement.hidden,
        'Not set remains reachable under filtering'
      );
      const before = options.map((r) => !!r.parentElement.hidden);
      await panel.fire('click', button('part', part.id));
      await panel.fire('click', button('part', part.id));
      assert.equal(input('native', part.id).value, pair.d);
      assert.deepEqual(
        panel.querySelectorAll('input[type="radio"]').map((r) => !!r.parentElement.hidden),
        before,
        'filter persists across disclosure'
      );
    }
  }
  controller.abort();
  handle.unmount();
  assert.equal(callbacks.size, 0);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

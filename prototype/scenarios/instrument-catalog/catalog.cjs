// Offline production-function oracle + DOM contract doubles. No browser/host integration claim.
// Run: node prototype/scenarios/instrument-catalog/catalog.cjs
// Requires repository dev dependency jsdom. MUTATION=name exercises a planted defect.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../../..');
const sourceRoot = process.env.CATALOG_SOURCE_ROOT || root;
const pins = {
  'src/app.js': '18578a05ee3b4e0cf36d59fc733d8894901f4adb',
  'src/pages/instrument.js': '3124f657ed00167c440651d905fadacd5453954b',
  'references/02_instruments.js': '0f67d61306b2a96bd005c7c01e34c52afd70357f',
  'references/01_family_parts.js': '683fcb102333c3671c06de6b816f12e1b45d74ee',
  'scripts/_merge.js': '971a36572bc8497d1033d7628d4826b22739d6a6',
};
const source = {};
for (const [file, expected] of Object.entries(pins)) {
  const bytes = fs.readFileSync(path.join(sourceRoot, file));
  const sha = crypto
    .createHash('sha1')
    .update('blob ' + bytes.length + '\0')
    .update(bytes)
    .digest('hex');
  assert.equal(sha, expected, 'Production input changed: requalify ' + file);
  source[file] = bytes.toString();
}
const part = (s, start, end) => {
  const from = s.indexOf(start),
    to = s.indexOf(end, from);
  assert(from >= 0 && to > from, 'source markers must resolve');
  return s.slice(from, to);
};
const context = vm.createContext({
  module: { exports: {} },
  UI: { instrumentFamily: '', instrumentClass: '' },
});
vm.runInContext(
  source['references/01_family_parts.js'] +
    source['references/02_instruments.js'] +
    source['scripts/_merge.js'] +
    '\nmergeFamilyParts(INSTRUMENTS,INSTRUMENT_FAMILY_PARTS);\n' +
    part(source['src/app.js'], 'const INSTRUMENT_FILTER_PREDS', '// ---- SONG FINGERPRINT') +
    part(source['src/app.js'], 'function normalizeSearch(s)', '// Toast text for a picker add.') +
    part(source['src/pages/instrument.js'], 'const IP =', 'const IP_TABS') +
    part(source['src/pages/instrument.js'], 'const ipByName', '// ── Images') +
    part(source['src/pages/instrument.js'], 'function ipMatches', 'function ipDest()') +
    '\nglobalThis.oracle={INSTRUMENTS,INSTRUMENT_FAMILIES,INSTRUMENT_FILTER_PILLS,IP_FILTER_GROUPS,normalizeSearch,ipMatches,ipRank,ipSorted,passesInstrumentFilter,IP,ipHuman};',
  context
);
const o = context.oracle;
const all = Array.from(o.INSTRUMENTS);
let checks = 0;
function check(name, test) {
  test();
  checks++;
  console.log('PASS ' + name);
}
const ids = (items) => Array.from(items, (i) => i.id);
const productionQuery = (query) => {
  const q = o.normalizeSearch(query);
  return o.ipSorted(
    all.filter((i) => o.ipMatches(i, { q, family: '', cls: '', filters: new Set() })),
    q
  );
};
check('real catalog and merged Oud', () => {
  assert.equal(all.length, 1671);
  assert.equal(all.find((i) => i.id === 'oud').parts.length, 7);
  assert.equal(o.INSTRUMENT_FAMILIES.length, 11);
});
check('canonical query ordering and exact id rank 1.5', () => {
  assert.deepEqual(ids(productionQuery('oud')), [
    'oud_arbi',
    'oud',
    'outi',
    'koudi',
    'rauschpfeife',
  ]);
  assert.deepEqual(ids(productionQuery('ud')).slice(0, 4), [
    'udu',
    'udukkai',
    'oud',
    'udmurt_kubyz',
  ]);
  assert.equal(
    o.ipRank(
      all.find((i) => i.id === 'oud'),
      'oud'
    ),
    1.5
  );
  assert.equal(o.normalizeSearch('  ʿŪd—CAFÉ  '), 'ud cafe');
});
check('AND and missing-axes production semantics', () => {
  assert.equal(
    all.filter((i) => o.passesInstrumentFilter(i, new Set(['sustained', 'decay']))).length,
    0
  );
  assert(o.passesInstrumentFilter({}, null));
  assert(!o.passesInstrumentFilter({}, new Set(['pitched'])));
});
// Real catalog records; subset only to keep DOM scenarios bounded. Canonical helpers
// supply query/ranks and properties; host wiring, photos and Listen are explicit doubles.
const fixtureIds = new Set([
  ...all
    .filter((i) => i.family === 'wind')
    .slice(0, 65)
    .map((i) => i.id),
  ...all
    .filter((i) => i.family === 'plucked_traditional')
    .slice(0, 20)
    .map((i) => i.id),
  ...ids(productionQuery('oud')),
  ...ids(productionQuery('ud')).slice(0, 4),
  'banjo_5_string',
]);
const actual = all.filter((i) => fixtureIds.has(i.id));
const ordered = o.ipSorted([...all]);
const groupOrder = Array.from(o.IP_FILTER_GROUPS, ([id, name]) => ({ id, name }));
const properties = Array.from(o.INSTRUMENT_FILTER_PILLS, (p) => ({
  id: p.id,
  label: p.label,
  groupId: o.IP_FILTER_GROUPS.find((g) => g[2].includes(p.id))?.[0],
}));
const freeze = (x) => {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    Object.values(x).forEach(freeze);
  }
  return x;
};
const fixture = freeze({
  families: Array.from(o.INSTRUMENT_FAMILIES, (f) => ({
    id: f.id,
    name: f.name,
    classes: [...new Set(all.filter((i) => i.family === f.id).map((i) => i.class))]
      .map((id) => ({ id, name: o.ipHuman(id) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })),
  })),
  properties,
  propertyGroups: groupOrder,
  sorts: [
    { id: 'name', name: 'Name A–Z' },
    { id: 'name-desc', name: 'Name Z–A' },
    { id: 'parts', name: 'Most customizable' },
  ],
  items: actual.map((i) => ({
    id: i.id,
    name: i.name,
    short: i.short,
    familyId: i.family,
    classId: i.class,
    partCount: i.parts.length,
    nameOrder: ordered.indexOf(i),
    propertyIds: properties
      .filter((p) => o.passesInstrumentFilter(i, new Set([p.id])))
      .map((p) => p.id),
    listenHref: i.id === 'oud' ? 'https://listen.example/oud' : null,
    photo:
      i.id === 'oud' ? ['../assets/fixture/oud.png', '', '', 'https://credit.example/oud'] : null,
  })),
});
let code = fs.readFileSync(
  path.join(root, 'prototype/features/instrument-catalog/catalog.js'),
  'utf8'
);
const mutations = {
  and: ['.every((id) => i.propertyIds.includes(id))', '.some((id) => i.propertyIds.includes(id))'],
  ranking: ['ranks.get(a.id) - ranks.get(b.id)', '0'],
  count: ['const prospective = new Set(filters)', 'const prospective = new Set()'],
  limit: ['filtered.slice(0, limit)', 'filtered'],
  best: ['.slice(0, 12)', '.slice(0, 1)'],
  destination: ['destination: dest', 'destination: null'],
  debounce: ['}, 600)', '}, 0)'],
  subscriptions: ['offRecipe?.();', ''],
  focus: ["body.querySelector('.ic-results h3')", "body.querySelector('h3')"],
  scroll: ['saved?.signature === ul.dataset.signature', 'saved'],
  tracking: ['syncCurrentRow();\n    rowFrame', '/* tracking removed */\n    rowFrame'],
  aim: ['if (rowAim) {', 'if (false) {'],
};
if (process.env.MUTATION) {
  const [from, to] = mutations[process.env.MUTATION] || [];
  assert(from && code.includes(from), 'mutation must change code');
  code = code.replace(from, to);
}
async function main() {
  const dom = new JSDOM('<div id="host"></div>', {
    runScripts: 'outside-only',
    url: 'https://fixture.example/',
  });
  const w = dom.window,
    host = w.document.getElementById('host');
  // Geometry is a DOM double, not rendered browser evidence.
  w.HTMLElement.prototype.getClientRects = () => [{ width: 1, height: 1 }];
  w.HTMLElement.prototype.scrollIntoView = () => {};
  const frames = new Map();
  let frameId = 0;
  w.requestAnimationFrame = (fn) => {
    frames.set(++frameId, fn);
    return frameId;
  };
  w.cancelAnimationFrame = (id) => frames.delete(id);
  const frame = () => {
    const pending = [...frames];
    frames.clear();
    pending.forEach(([, fn]) => fn());
  };
  const tops = new Map();
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    const group = this.dataset.group;
    const top = group
      ? (tops.get(group) ?? 80 + [...host.querySelectorAll('[data-group]')].indexOf(this) * 300)
      : 0;
    return { top, bottom: top + 44, left: 0, right: 100, width: 100, height: 44 };
  };
  const timers = new Map();
  let clock = 0,
    serial = 0;
  w.setTimeout = (fn, delay) => {
    timers.set(++serial, { at: clock + delay, fn });
    return serial;
  };
  w.clearTimeout = (id) => timers.delete(id);
  function tick(ms) {
    clock += ms;
    for (const [id, t] of timers)
      if (t.at <= clock) {
        timers.delete(id);
        t.fn();
      }
  }
  w.eval(
    code
      .replace('export function mount', 'function mount')
      .replace('import.meta.url', "'https://fixture.example/catalog.js'") +
      '\nwindow.mountCatalog=mount;'
  );
  let selected = null,
    state = {
      status: 'ready',
      busy: false,
      revision: 7,
      groups: [{ genreId: 'bluegrass', name: 'Bluegrass', count: 1 }],
      instrumentActions: {
        destination: 'bluegrass',
        destinations: [
          { genreId: null, name: 'Independent instrument' },
          { genreId: 'bluegrass', name: 'Bluegrass' },
        ],
      },
    };
  const calls = [],
    announcements = [],
    writes = [],
    listeners = new Set(),
    selections = new Set();
  let loads = 0,
    loader = async () => fixture;
  const ctx = {
    storage: {
      read: () => ({ ok: true, value: 'grid' }),
      write: (key, value) => {
        writes.push([key, value]);
        return { ok: true };
      },
    },
    announce: (text) => announcements.push(text),
    loadInstrumentCatalog: (options) => {
      loads++;
      return loader(options);
    },
    catalog: {
      normalize: o.normalizeSearch,
      search: (query) => {
        const q = o.normalizeSearch(query);
        return freeze({
          normalizedQuery: q,
          matches: actual
            .filter((i) => o.ipMatches(i, { q, family: '', cls: '', filters: new Set() }))
            .map((i) => ({ id: i.id, rank: o.ipRank(i, q) })),
        });
      },
    },
    instrument: {
      current: () => selected,
      subscribe: (fn) => {
        selections.add(fn);
        return () => selections.delete(fn);
      },
    },
    media: { resolve: (url) => (url === '../assets/fixture/oud.png' ? url : null) },
    openPhoto: (...args) => calls.push(['photo', ...args]),
    openInstrument: (...args) => {
      calls.push(['open', ...args]);
      selected = args[0];
      selections.forEach((fn) => fn());
    },
    recipe: {
      snapshot: () => state,
      subscribe: (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      addInstrument: (arg) => {
        calls.push(['add', arg]);
        return Promise.resolve({ snapshot: state, placed: 'independent' });
      },
    },
  };
  const settle = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };
  const get = (key) => [...host.querySelectorAll('[data-key]')].find((n) => n.dataset.key === key);
  function click(key) {
    const n = get(key);
    assert(n, 'control exists: ' + key);
    n.focus();
    n.click();
  }
  function input(value) {
    const n = host.querySelector('input[type=search]');
    n.value = value;
    n.dispatchEvent(new w.Event('input', { bubbles: true }));
  }
  function property(id) {
    const n = host.querySelector('[data-property="' + id + '"]');
    n.focus();
    n.dispatchEvent(new w.Event('change', { bubbles: true }));
  }
  const displayed = () => [...host.querySelectorAll('[data-item]')].map((n) => n.dataset.item);
  let handle = w.mountCatalog(host, ctx);
  await settle();
  check('fresh load, stylesheet, legacy grid maps to rows', () => {
    assert.equal(loads, 1);
    assert(host.querySelector('link[rel=stylesheet]'));
    assert.equal(get('view:rows').getAttribute('aria-pressed'), 'true');
    assert.equal(writes.length, 0);
  });
  check('full-catalog group order and no duplicates', () => {
    const groups = [...host.querySelectorAll('[data-group]')].map((n) => n.dataset.group);
    assert.equal(groups[0], 'wind');
    assert.equal(new Set(displayed()).size, fixture.items.length);
  });
  check('row tracking follows shell scroll geometry without a scroll event', () => {
    const groups = [...host.querySelectorAll('[data-group]')].map((n) => n.dataset.group);
    assert.equal(get('jump:' + groups[0]).getAttribute('aria-current'), 'true');
    tops.set(groups[0], -300);
    tops.set(groups[1], 50);
    frame();
    assert.equal(get('jump:' + groups[1]).getAttribute('aria-current'), 'true');
    tops.clear();
  });
  check('short final-row jump holds until geometry moves', () => {
    const groups = [...host.querySelectorAll('[data-group]')].map((n) => n.dataset.group);
    const last = groups.at(-1);
    click('jump:' + last);
    frame();
    assert.equal(get('jump:' + last).getAttribute('aria-current'), 'true');
    tops.set(last, 9000);
    frame();
    assert.equal(get('jump:' + groups[0]).getAttribute('aria-current'), 'true');
    tops.clear();
  });
  check('unchanged rows preserve scroll, changed order resets', () => {
    const track = host.querySelector('[data-track=wind]');
    track.scrollLeft = 120;
    click('categories');
    assert.equal(host.querySelector('[data-track=wind]').scrollLeft, 120);
    const select = get('sort');
    select.value = 'name-desc';
    select.dispatchEvent(new w.Event('change'));
    assert.equal(host.querySelector('[data-track=wind]').scrollLeft, 0);
    const again = get('sort');
    again.value = 'name';
    again.dispatchEvent(new w.Event('change'));
  });
  input('oud');
  check('real ranked matches, top group and canonical id tier', () => {
    assert.deepEqual(displayed(), ['oud_arbi', 'oud', 'outi', 'koudi', 'rauschpfeife']);
    assert.equal(
      host.querySelector('[data-group=best]')?.querySelectorAll('[data-item]').length,
      3
    );
  });
  check('600ms announcement only, no filter debounce', () => {
    assert.equal(announcements.length, 0);
    tick(599);
    assert.equal(announcements.length, 0);
    tick(1);
    assert.equal(announcements.pop(), '5 instruments');
  });
  input('ud');
  check('search replaces pending announcement and canonical tiers', () => {
    tick(600);
    assert.deepEqual(displayed().slice(0, 4), ['udu', 'udukkai', 'oud', 'udmurt_kubyz']);
  });
  input('');
  click('view:list');
  check('list50 and Show more', () => {
    assert.equal(displayed().length, 50);
    click('more');
    assert.equal(displayed().length, Math.min(100, fixture.items.length));
    assert(
      w.document.activeElement === get('more') ||
        w.document.activeElement === host.querySelector('.ic-results h3')
    );
  });
  input('oud');
  click('open:oud');
  check('opening uses shell selection and exact focus handle', () => {
    assert.equal(calls.at(-1)[0], 'open');
    assert.equal(calls.at(-1)[1], 'oud');
    assert.equal(calls.at(-1)[2].returnFocus, get('open:oud'));
    assert.equal(host.querySelector('[data-item=oud]').getAttribute('aria-current'), 'true');
  });
  click('photo:oud');
  check('photo and Listen are delegated safely', () => {
    assert.equal(calls.at(-1)[0], 'photo');
    assert.equal(calls.at(-1)[1], fixture.items.find((i) => i.id === 'oud').photo);
    const a = host.querySelector('a[href="https://listen.example/oud"]');
    assert.equal(a.rel, 'noopener noreferrer');
    assert(host.textContent.includes('Photo: uncredited · licence not stated'));
  });
  click('add:oud');
  await settle();
  check('quick Add uses shared destination and recipe revision, not preview', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))), [
      'add',
      { instrumentId: 'oud', destination: 'bluegrass', revision: 7 },
    ]);
    assert.equal(w.document.activeElement, get('add:oud'));
  });
  const saved = state;
  state = { ...state, instrumentActions: undefined };
  listeners.forEach((fn) => fn());
  const before = calls.length;
  click('add:oud');
  await settle();
  check('missing destination refuses instead of guessing independent', () => {
    assert.equal(calls.length, before);
    assert(host.textContent.includes('isn’t available in this build'));
  });
  state = saved;
  listeners.forEach((fn) => fn());
  input('');
  property('sustained');
  check('prospective count adds to active filters', () => {
    assert.equal(host.querySelector('[data-prospective=decay]').textContent, '0');
    assert(
      displayed().every((id) =>
        fixture.items.find((i) => i.id === id).propertyIds.includes('sustained')
      )
    );
  });
  property('decay');
  check('AND conflict names and recovery', () => {
    assert.equal(displayed().length, 0);
    assert(host.textContent.includes('No instrument in the catalogue is'));
    click('remove:decay');
    assert(displayed().length > 0);
  });
  click('clear-all');
  click('family:wind');
  check('family counts ignore selected family, class chips present', () => {
    assert.equal(
      host.querySelector('[data-family=plucked_traditional]').dataset.countValue,
      String(fixture.items.filter((i) => i.familyId === 'plucked_traditional').length)
    );
    assert(host.querySelector('[data-class]'));
  });
  click('back');
  check('back to all restores results heading focus', () =>
    assert.equal(w.document.activeElement, host.querySelector('.ic-results h3'))
  );
  const sortSelect = get('sort');
  sortSelect.value = 'parts';
  sortSelect.dispatchEvent(new w.Event('change'));
  check('merged part count sorting', () => {
    const expected = fixture.items
      .slice()
      .sort((a, b) => b.partCount - a.partCount || a.nameOrder - b.nameOrder);
    assert.deepEqual(
      displayed(),
      expected.slice(0, 50).map((i) => i.id)
    );
  });
  check('only view is persisted', () => assert.deepEqual(writes, [['view', 'list']]));
  input('oud');
  const countBefore = announcements.length;
  handle.unmount();
  tick(1000);
  check('unmount clears timers/subscriptions/style and DOM', () => {
    assert.equal(host.children.length, 0);
    assert.equal(listeners.size, 0);
    assert.equal(selections.size, 0);
    assert.equal(announcements.length, countBefore);
    assert.equal(frames.size, 0);
  });
  let resolve;
  loader = () =>
    new Promise((r) => {
      resolve = r;
    });
  handle = w.mountCatalog(host, ctx);
  handle.unmount();
  resolve(fixture);
  await settle();
  check('late load does not resurrect unmounted UI', () => assert.equal(host.children.length, 0));
  loader = async () => {
    throw Object.assign(
      new Error('This instrument’s details couldn’t load. Check your connection, then try again.'),
      { code: 'LOAD_FAILED' }
    );
  };
  handle = w.mountCatalog(host, ctx);
  await settle();
  check('loader guidance verbatim', () =>
    assert(
      host.textContent.includes(
        'This instrument’s details couldn’t load. Check your connection, then try again.'
      )
    )
  );
  loader = async () => fixture;
  click('retry');
  await settle();
  check('retry resets ephemeral state and restores focus', () => {
    assert.equal(host.querySelector('input[type=search]').value, '');
    assert.equal(get('sort').value, 'name');
    assert.equal(w.document.activeElement, host.querySelector('input[type=search]'));
  });
  handle.unmount();
  dom.window.close();
  console.log(
    JSON.stringify(
      {
        checks,
        realCatalogRecords: all.length,
        domFixtureRecords: fixture.items.length,
        browser: 'not executed',
        pins,
      },
      null,
      2
    )
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

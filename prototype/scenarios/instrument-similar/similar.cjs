// Standalone DOM/source scenario for #670 row 207; no shell/engine Add/Undo,
// browser layout, actual image delivery or lightbox integration claim.
// node prototype/scenarios/instrument-similar/similar.cjs [--mutations]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { JSDOM } = require('jsdom');
const repo = path.resolve(__dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(repo, p), 'utf8');
const featurePath = 'prototype/features/instrument-similar/similar.js';
let source = read(featurePath);
const mutations = {
  order: [
    'for (const neighbour of record.neighbours)',
    'for (const neighbour of [...record.neighbours].reverse())',
    'production order',
  ],
  stale: [
    'disposed || seq !== generation || snapshot().instrumentActions?.instrumentId !== id',
    'disposed',
    'stale A-B-A',
  ],
  destination: [
    'destination: s.instrumentActions.destination',
    'destination: null',
    'current destination',
  ],
  revision: ['revision: s.revision', 'revision: 0', 'current destination'],
  focus: ['moveFocus && doc.activeElement === status', 'moveFocus', 'Retry does not steal'],
  unsubscribe: ['unsubscribe();', '/* unsubscribe removed */', 'unsubscribes'],
  remote: ['ctx.media.resolve(photo[0])', 'photo[0]', 'remote photo'],
  labels: [
    'neighbour.agreements.join(',
    '[...neighbour.agreements].reverse().join(',
    'production order',
  ],
};
if (process.argv.includes('--mutations')) {
  for (const [name, [, , expected]] of Object.entries(mutations)) {
    const r = spawnSync(process.execPath, [__filename], {
      env: { ...process.env, SIMILAR_MUTATION: name },
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.notEqual(r.status, 0, `${name} escaped`);
    assert.match(
      r.stderr,
      new RegExp(expected),
      `${name} failed for the wrong reason: ${r.stderr}`
    );
    console.log(`REJECTED ${name}: ${expected}`);
  }
  process.exit(0);
}
if (process.env.SIMILAR_MUTATION) {
  const [before, after] = mutations[process.env.SIMILAR_MUTATION];
  assert(source.includes(before), 'mutation must apply');
  source = source.replaceAll(before, after);
}
// Execute actual production rankings against real catalog records. The fixed
// expected lists below pin order/ties rather than deriving our expected output
// from the function under test. Selection/media/recipe commands below are stubs.
const engine = vm.createContext({});
vm.runInContext(
  read('references/02_instruments.js') +
    '\n' +
    read('references/03_rooms_chains_tunings.js') +
    '\nconst Inst = id => INSTRUMENTS.find(i => i.id === id);',
  engine
);
function extract(text, name) {
  const start = text.indexOf(`function ${name}(`);
  assert(start >= 0, name);
  const tail = text.slice(start);
  return tail.slice(0, tail.indexOf('\n}') + 2);
}
vm.runInContext(
  ['instAxes', 'computeInstrumentDistance', 'findSimilarInstruments', 'getMatchingInstrumentAxes']
    .map((n) => extract(read('src/app.js'), n))
    .join('\n'),
  engine
);
const expected = {
  oud: [
    'comorian_gambusi',
    'cobza',
    'acoustic_guitar_dread',
    'acoustic_guitar_om',
    'classical_nylon_string_guitar',
    'rudra_veena',
  ],
  fiddle: [
    'violin_carnatic',
    'violin_orchestral',
    'latfiol',
    'hardanger_fiddle_inst',
    'viola_classical',
    'sorahi',
  ],
  grand_piano: [
    'upright_piano',
    'concert_harp',
    'jazz_trio_piano',
    'tack_piano',
    'steel_orchestra',
    'russian_seven_string_guitar',
  ],
  electric_guitar_humbucker: [
    'electric_guitar_single_coil',
    'baritone_electric',
    'semi_hollow',
    'twelve_string_electric',
    'archtop_jazz',
    'electric_bass',
  ],
  voice: [
    'griot_voice',
    'qawwal_voice',
    'human_voice_ensemble_unspecified',
    'spoken_dramatic_cast',
    'pansori_voice',
    'erhu',
  ],
};
const photos = JSON.parse(read('api/instrument_images.json')).instruments;
const records = {};
const glyph =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"></svg>');
for (const [id, ids] of Object.entries(expected)) {
  const neighbours = JSON.parse(JSON.stringify(engine.findSimilarInstruments(id, 6)));
  assert.deepEqual(
    neighbours.map((n) => n.id),
    ids,
    `production fixture ${id}`
  );
  records[id] = {
    id,
    name: id,
    neighbours: neighbours.map((n) => ({
      id: n.id,
      name: n.name,
      agreements: JSON.parse(JSON.stringify(engine.getMatchingInstrumentAxes(id, n.id, 2))).map(
        (a) => a.axis.name.toLowerCase()
      ),
      photo: photos[n.id] || null,
      glyphUrl: glyph,
      listenHref: `https://www.youtube.com/results?search_query=${encodeURIComponent(n.name + ' musical instrument solo demonstration')}`,
    })),
  };
}
assert.deepEqual(records.oud.neighbours[0].agreements, [
  'articulation bandwidth',
  'transduction mode',
]);
const freeze = (x) => {
  if (x && typeof x === 'object') {
    Object.values(x).forEach(freeze);
    Object.freeze(x);
  }
  return x;
};
Object.values(records).forEach(freeze);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
let count = 0;
async function check(name, fn) {
  try {
    await fn();
    count++;
    console.log(`PASS ${name}`);
  } catch (e) {
    throw new Error(`${name}: ${e.message}`, { cause: e });
  }
}
function harness(record = records.oud, aborted = false) {
  const dom = new JSDOM('<button id="outside">Outside</button><div id="host"></div>', {
    url: 'https://fixture.test/prototype/',
    runScripts: 'outside-only',
  });
  const w = dom.window,
    doc = w.document,
    host = doc.getElementById('host');
  const signal = new w.AbortController();
  if (aborted) signal.abort();
  let state = freeze({
    status: 'ready',
    busy: false,
    revision: 1,
    instrumentActions: {
      instrumentId: record?.id || null,
      status: 'ready',
      destination: 'bluegrass',
      previewRevision: 4,
    },
  });
  const subscriptions = new Set(),
    requests = [],
    adds = [],
    opens = [],
    mediaCalls = [],
    announced = [];
  let loader = (id) => Promise.resolve(records[id] || record);
  const ctx = Object.freeze({
    signal: signal.signal,
    announce: (x) => announced.push(x),
    recipe: Object.freeze({
      snapshot: () => state,
      subscribe: (fn) => {
        subscriptions.add(fn);
        return () => subscriptions.delete(fn);
      },
      addInstrument: (x) => {
        adds.push(x);
        return Promise.resolve({ snapshot: state, placed: 'grouped' });
      },
    }),
    loadInstrumentSimilar: (id, options) => {
      requests.push({ id, ...options });
      return loader(id, options);
    },
    openInstrument: (id, options) => {
      opens.push({ id, ...options });
      return Promise.resolve();
    },
    media: Object.freeze({
      resolve: (x) => (typeof x === 'string' && x.startsWith('../assets/') ? x : null),
    }),
    openPhoto: (photo, options) => {
      mediaCalls.push({ photo, ...options });
    },
  });
  // Module syntax/URL adaptation only; every executable feature function is
  // evaluated unchanged in the DOM realm, with its own AbortController.
  w.eval(
    source
      .replace('export function mount', 'function mount')
      .replaceAll('import.meta.url', JSON.stringify('https://fixture.test/' + featurePath)) +
      '\nglobalThis.featureMount=mount;'
  );
  const api = w.featureMount(host, ctx);
  return {
    w,
    doc,
    host,
    api,
    signal,
    subscriptions,
    requests,
    adds,
    opens,
    mediaCalls,
    announced,
    loader: (fn) => {
      loader = fn;
    },
    emit: (patch) => {
      state = freeze({
        ...state,
        ...patch,
        instrumentActions: { ...state.instrumentActions, ...patch.instrumentActions },
      });
      for (const fn of subscriptions) fn();
    },
    buttons: () => [...host.querySelectorAll('.instrument-similar-open')],
    close: () => {
      api.unmount();
      dom.window.close();
    },
    state: () => state,
  };
}
(async () => {
  let h = harness();
  await tick();
  await check('production order and two lowercase labels for five fixtures', async () => {
    for (const [id, record] of Object.entries(records)) {
      h.emit({ instrumentActions: { instrumentId: id } });
      await tick();
      assert.deepEqual(
        h.buttons().map((x) => x.firstElementChild.textContent),
        record.neighbours.map((n) => n.name)
      );
      assert.deepEqual(
        [...h.host.querySelectorAll('.instrument-similar-agreements')].map((x) => x.textContent),
        record.neighbours.map((n) => 'Closest on ' + n.agreements.join(', '))
      );
    }
  });
  h.emit({ instrumentActions: { instrumentId: 'oud' } });
  await tick();
  await check('self-loaded scoped CSS and semantic section/list', () => {
    assert(h.host.querySelector('link').href.endsWith('/instrument-similar/similar.css'));
    assert.equal(h.host.querySelector('section').getAttribute('aria-label'), 'Similar instruments');
    assert.equal(h.host.querySelector('ul').getAttribute('role'), 'list');
  });
  await check(
    'current destination and revision, no preview mutation or focus stealing',
    async () => {
      h.emit({ revision: 17, instrumentActions: { destination: 'tarab', previewRevision: 80 } });
      await tick();
      const add = h.host.querySelector('li').lastElementChild;
      add.focus();
      add.click();
      await tick();
      assert.deepEqual(JSON.parse(JSON.stringify(h.adds.at(-1))), {
        instrumentId: expected.oud[0],
        destination: 'tarab',
        revision: 17,
      });
      assert.equal(h.doc.activeElement, add);
      assert.equal(h.announced.length, 0);
    }
  );
  await check('Similar navigation carries current origin and preview revision', async () => {
    const b = h.buttons()[0];
    b.click();
    await tick();
    const x = h.opens.at(-1);
    assert.equal(x.id, expected.oud[0]);
    assert.equal(x.fromInstrumentId, 'oud');
    assert.equal(x.previewRevision, 80);
    assert.equal(x.similar, true);
    assert.equal(x.returnFocus, b);
  });
  await check('recipe busy blocks controls; preview busy blocks inspect only', async () => {
    const before = h.adds.length;
    h.emit({ busy: true });
    h.host.querySelector('li').lastElementChild.click();
    await tick();
    assert.equal(h.adds.length, before);
    h.emit({ busy: false, instrumentActions: { status: 'loading' } });
    await tick();
    assert(h.buttons()[0].disabled);
    assert(!h.host.querySelector('li').lastElementChild.disabled);
    h.emit({ instrumentActions: { status: 'ready' } });
    await tick();
  });
  await check('native Listen destination and security attributes', () => {
    const a = h.host.querySelector('li a');
    assert.equal(a.href, records.oud.neighbours[0].listenHref);
    assert.equal(a.target, '_blank');
    assert.equal(a.rel, 'noopener noreferrer');
  });
  await check('remote photo never bypasses media resolver; no unavailable credit', () => {
    assert([...h.host.querySelectorAll('img')].every((x) => !x.src.startsWith('https://')));
    assert([...h.host.querySelectorAll('.instrument-similar-credit')].every((x) => x.hidden));
  });
  await check('media arrival/failure preserves nodes, focus, callback and credit', async () => {
    const row = h.host.querySelector('li'),
      open = h.buttons()[0],
      media = row.firstElementChild,
      img = media.firstElementChild;
    const photo = [
      '../assets/test/local.svg',
      'CC BY 4.0',
      'Fixture author',
      'https://example.test/source',
    ];
    const changed = {
      ...records.oud,
      neighbours: records.oud.neighbours.map((n, i) => (i ? n : { ...n, photo })),
    };
    open.focus();
    h.loader(() => Promise.resolve(freeze(changed)));
    h.emit({ revision: 18 });
    await tick();
    assert.equal(h.host.querySelector('li'), row);
    assert.equal(h.buttons()[0], open);
    assert.equal(media.firstElementChild, img);
    assert.equal(h.doc.activeElement, open);
    img.dispatchEvent(new h.w.Event('load'));
    assert.equal(
      row.querySelector('.instrument-similar-credit').textContent,
      'Photo: Fixture author · CC BY 4.0'
    );
    media.focus();
    media.click();
    await tick();
    assert.equal(h.mediaCalls.at(-1).photo, photo);
    assert.equal(h.mediaCalls.at(-1).returnFocus, media);
    img.dispatchEvent(new h.w.Event('error'));
    assert.equal(h.doc.activeElement, media);
    assert(row.querySelector('.instrument-similar-credit').hidden);
    assert(img.src.startsWith('data:image/svg+xml'));
    const calls = h.mediaCalls.length;
    media.click();
    await tick();
    assert.equal(h.mediaCalls.length, calls);
  });
  h.close();
  h = harness();
  await tick();
  await check('stale A-B-A responses cannot replace latest list', async () => {
    const a = deferred(),
      b = deferred(),
      last = deferred();
    let n = 0;
    h.loader(() => [a, b, last][n++].promise);
    h.emit({ revision: 2 });
    h.emit({ instrumentActions: { instrumentId: 'fiddle' } });
    h.emit({ instrumentActions: { instrumentId: 'oud' } });
    assert(h.requests.at(-3).signal.aborted);
    assert(h.requests.at(-2).signal.aborted);
    last.resolve(records.oud);
    await tick();
    b.resolve(records.fiddle);
    a.resolve({ ...records.oud, neighbours: [] });
    await tick();
    assert.equal(h.buttons().length, 6);
    assert.equal(h.buttons()[0].firstElementChild.textContent, records.oud.neighbours[0].name);
  });
  async function fail() {
    h.loader(() =>
      Promise.reject(Object.assign(new Error('raw internal text'), { code: 'LOAD_FAILED' }))
    );
    h.emit({ revision: h.state().revision + 1 });
    await tick();
  }
  await fail();
  await check('loader failure uses exact Instrument sentence and only lane Retry', () => {
    assert.equal(
      h.host.querySelector('[role=status]').textContent,
      'This instrument’s details couldn’t load. Try again.'
    );
    assert.equal(
      [...h.host.querySelectorAll('button')].filter((x) => x.textContent === 'Retry' && !x.hidden)
        .length,
      1
    );
  });
  await check(
    'Retry success focuses first neighbour; host update cannot cancel focus intent',
    async () => {
      const d = deferred();
      h.loader(() => d.promise);
      h.host.querySelector('section > button').click();
      const request = h.requests.at(-1);
      h.emit({ revision: 31 });
      assert.equal(h.requests.at(-1), request);
      d.resolve(records.oud);
      await tick();
      assert.equal(h.doc.activeElement, h.buttons()[0]);
    }
  );
  await fail();
  await check('Retry does not steal focus after user leaves lane', async () => {
    const d = deferred();
    h.loader(() => d.promise);
    h.host.querySelector('section > button').click();
    h.doc.getElementById('outside').focus();
    d.resolve(records.oud);
    await tick();
    assert.equal(h.doc.activeElement.id, 'outside');
  });
  await fail();
  await check('repeated Retry failure focuses Retry', async () => {
    h.host.querySelector('section > button').click();
    await tick();
    assert.equal(h.doc.activeElement, h.host.querySelector('section > button'));
  });
  await check('empty Retry success preserves empty heading/list and focuses heading', async () => {
    h.loader(() => Promise.resolve({ ...records.oud, neighbours: [] }));
    h.host.querySelector('section > button').click();
    await tick();
    assert.equal(h.buttons().length, 0);
    assert(h.host.querySelector('h3'));
    assert(h.host.querySelector('ul'));
    assert.equal(h.doc.activeElement, h.host.querySelector('h3'));
    assert.equal(h.host.querySelector('[role=status]').textContent, '');
  });
  await fail();
  await check(
    'Retry finishing while busy focuses visible heading instead of disabled control',
    async () => {
      const d = deferred();
      h.loader(() => d.promise);
      h.host.querySelector('section > button').click();
      h.emit({ busy: true });
      d.resolve(records.oud);
      await tick();
      assert.equal(h.doc.activeElement, h.host.querySelector('h3'));
      assert(h.buttons()[0].disabled);
      h.emit({ busy: false });
      await tick();
    }
  );
  await fail();
  await check('selection clears pending Retry and prevents late focus', async () => {
    const d = deferred();
    h.loader(() => d.promise);
    h.host.querySelector('section > button').click();
    h.emit({ instrumentActions: { instrumentId: null } });
    h.doc.getElementById('outside').focus();
    d.resolve(records.oud);
    await tick();
    assert.equal(h.buttons().length, 0);
    assert.equal(h.doc.activeElement.id, 'outside');
    assert.equal(h.host.querySelector('[role=status]').textContent, 'Select an instrument');
  });
  await check('NOT_FOUND uses exact sentence and Retry without invented diagnosis', async () => {
    h.loader(() => Promise.reject(Object.assign(new Error('x'), { code: 'NOT_FOUND' })));
    h.emit({ instrumentActions: { instrumentId: 'invalid' } });
    await tick();
    assert.equal(
      h.host.querySelector('[role=status]').textContent,
      'This instrument isn’t in the catalog’s data. Select another instrument.'
    );
    assert(!h.host.querySelector('section > button').hidden);
  });
  await check('unmount aborts wait, unsubscribes, removes CSS and ignores completion', async () => {
    const d = deferred();
    h.loader(() => d.promise);
    h.host.querySelector('section > button').click();
    const req = h.requests.at(-1);
    h.api.unmount();
    h.api.unmount();
    assert(req.signal.aborted);
    assert.equal(h.subscriptions.size, 0);
    d.resolve(records.oud);
    await tick();
    assert.equal(h.host.children.length, 0);
  });
  h.close();
  await check('already aborted mount is inert', async () => {
    const x = harness(records.oud, true);
    await tick();
    assert.equal(x.host.children.length, 0);
    assert.equal(x.subscriptions.size, 0);
    assert.equal(x.requests.length, 0);
    x.close();
  });
  console.log(
    `${count} checks passed; five pinned real catalog rankings. DOM/source only; commands and media delivery stubbed.`
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

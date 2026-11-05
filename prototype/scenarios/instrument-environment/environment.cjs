// Local contract/DOM checks, not shell integration or browser qualification.
// NODE_PATH=<installed jsdom> ENVIRONMENT_SOURCE_ROOT=<pinned main tree> node <this file>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const Module = require('node:module');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const { JSDOM } = require('jsdom');
const repo = path.resolve(__dirname, '../../..');
const sourceRoot = process.env.ENVIRONMENT_SOURCE_ROOT || repo;
const feature = path.join(repo, 'prototype/features/instrument-environment/environment.js');
const source = fs.readFileSync(process.env.ENVIRONMENT_FEATURE_FILE || feature, 'utf8');
const mainPin = 'fd16719d46217adc9b57ef939c9497e29e77741c';
// Original source is evaluated unchanged except exposing lexical functions.
// Keep this oracle explicitly pinned; a new source version needs qualification.
const pins = {
  'src/app.js': '18578a05ee3b4e0cf36d59fc733d8894901f4adb',
  'src/pages/instrument.js': '3124f657ed00167c440651d905fadacd5453954b',
  'scripts/_loader.js': '7c8b0a104617b019d60b63aa16b45062c6872fff',
  'scripts/_load_app.js': '67f0ebf8c16a3a6996626ed134ceed599008a33d',
  'scripts/_merge.js': '971a36572bc8497d1033d7628d4826b22739d6a6',
  'scripts/_card_descriptors.js': '38508947b4d99bf33a9c6d614d697831bd47bf8f',
  'scripts/_recipe_stack.js': '4c28f906c19eaa7511331d17574fccd5854403dc',
  'references/01_family_parts.js': '683fcb102333c3671c06de6b816f12e1b45d74ee',
  'references/02_instruments.js': '0f67d61306b2a96bd005c7c01e34c52afd70357f',
  'references/03_rooms_chains_tunings.js': '2240639fd08b0ae27b2b72c2f0fdecf68be973cd',
  'references/04_tree.js': 'a95229bda61077ede344f5a96a04615c8e8d6381',
  'references/05_traditions.js': 'f8b910676eac35dcaf8ec00e5e5b531a40fb91c0',
  'references/06_extras.js': 'a323b50c0eeb5957092d805559c6cfe678607da3',
  'references/07_preface_lexicon.js': 'd40864add15d7c17e43d0ea233deae9809bddaa5',
  'references/08_asset_manifest.js': '032b80865887bf60b29c770867ed0762ec90a508',
  'references/09_nav_glyphs.js': '365e140d5a2d07012894046dfca082724ad8da22',
  'references/10_tradition_signatures.js': '7234277e696943f4e1d7d9d9164137e613e07eae',
  'references/_tradition_aliases.json': '1aa692e7a3405be1a74bf87fcc7b3df08e117f21',
};
for (const [file, sha] of Object.entries(pins)) {
  const bytes = fs.readFileSync(path.join(sourceRoot, file));
  assert.equal(
    createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
    sha,
    `Oracle source differs from ${mainPin}: ${file}`
  );
}
const C = require(path.join(sourceRoot, 'scripts/_loader.js'));
let loader = fs.readFileSync(path.join(sourceRoot, 'scripts/_load_app.js'), 'utf8');
loader = loader.replace(
  "'Catalog',",
  "'Catalog', 'Tuning', 'Room', 'entryRenderDescs', 'compileStack', 'ipApply',"
);
loader = loader.replace(
  "const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');",
  "const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8') + '\\n' + fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'instrument.js'), 'utf8');"
);
global.uiRegisterPage = () => {};
const modulePath = path.join(sourceRoot, 'scripts/_load_app.js');
const engineModule = new Module(modulePath);
engineModule.filename = modulePath;
engineModule.paths = Module._nodeModulePaths(path.dirname(modulePath));
engineModule._compile(loader, modulePath);
const engine = engineModule.exports.loadApp();
delete global.uiRegisterPage;
const mount = new Function(
  source
    .replace('export function mount', 'function mount')
    .replaceAll('import.meta.url', JSON.stringify(pathToFileURL(feature).href)) + '\nreturn mount;'
)();
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const options = {
  tuning: C.TUNINGS.map(({ id, name }) => ({ id, name })),
  room: C.ROOMS.map(({ id, name }) => ({ id, name })),
};
assert.equal(options.tuning.length, 122);
assert.equal(options.room.length, 256);
function snapshot(card, revision = 1, sourceMessage = 'Supplied source message <b>verbatim</b>.') {
  return freeze({
    status: 'ready',
    error: null,
    instrumentId: card.instrumentId,
    revision,
    fields: ['tuning', 'room'].map((key) => ({
      key,
      value: card[key],
      options: options[key],
      descriptors: engine.entryRenderDescs(
        key === 'tuning' ? engine.Tuning(card[key]) : engine.Room(card[key])
      ),
    })),
    sourceMessage,
  });
}
function harness(initial, preaborted = false) {
  const dom = new JSDOM('<div id="host"></div><button id="outside">Outside</button>');
  const doc = dom.window.document;
  const host = doc.querySelector('#host');
  const controller = new AbortController();
  if (preaborted) controller.abort();
  let current = initial;
  const listeners = new Set(),
    calls = [],
    announcements = [];
  const port = Object.freeze({
    snapshot: () => current,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    choose: (args) => new Promise((resolve, reject) => calls.push({ args, resolve, reject })),
  });
  const handle = mount(
    host,
    Object.freeze({
      environment: port,
      signal: controller.signal,
      announce: (s) => announcements.push(s),
    })
  );
  return {
    doc,
    host,
    controller,
    handle,
    listeners,
    calls,
    announcements,
    push(next, notify = true) {
      current = next;
      if (notify) [...listeners].forEach((fn) => fn());
    },
    change(key, id) {
      const select = host.querySelector(`[data-field="${key}"]`);
      select.value = id ?? '';
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    },
    close() {
      handle.unmount();
      dom.window.close();
    },
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
let cases = 0;
async function check(name, fn) {
  await fn();
  cases++;
  console.log(`PASS ${name}`);
}
async function run() {
  for (const [id, dest, expectedTuning, expectedRoom] of [
    ['oud', null, null, null],
    [
      'banjo_5_string',
      'bluegrass',
      'bluegrass_high_lonesome_pentatonic',
      'bristol_sessions_appalachian_pre_commercial',
    ],
    ['electric_guitar_single_coil', 'afrobeat', 'twelve_tet', 'studio_emi_lagos_african'],
  ])
    await check(`canonical ${id}`, async () => {
      const card = engine.makeCard(id, dest ? engine.traditionCardOpts(dest, id) : undefined);
      assert.equal(card.tuning, expectedTuning);
      assert.equal(card.room, expectedRoom);
      const initial = snapshot(card),
        original = JSON.stringify(initial);
      const h = harness(initial);
      assert.equal(h.host.querySelectorAll('select').length, 2);
      assert.equal(h.host.querySelector('.ie-source').textContent, initial.sourceMessage);
      assert.equal(h.host.querySelector('.ie-source b'), null);
      for (const field of initial.fields) {
        const select = h.host.querySelector(`[data-field="${field.key}"]`);
        assert.deepEqual(
          [...select.options].map((o) => [o.value, o.textContent]),
          [['', 'Not set'], ...field.options.map((o) => [o.id, o.name])]
        );
        assert.equal(select.value, field.value ?? '');
        assert.equal(
          select.closest('.ie-field').querySelector('p').textContent,
          field.descriptors.join(', ')
        );
      }
      h.handle.focus();
      const select = h.doc.activeElement;
      assert.equal(select.dataset.field, 'tuning');
      const live = JSON.stringify(engine.app.cards);
      const before = engine.compileStack(card, 'compact');
      const nextId = card.tuning === 'twelve_tet' ? 'just_intonation' : 'twelve_tet';
      h.change('tuning', nextId);
      assert.deepEqual(h.calls[0].args, { field: 'tuning', id: nextId, revision: 1 });
      assert.equal(select.value, expectedTuning ?? '');
      engine.ipApply(card, { k: 'tuning', v: nextId });
      h.push(snapshot(card, 2));
      h.calls[0].resolve(snapshot(card, 2));
      await tick();
      assert.equal(select.value, nextId);
      assert.equal(h.doc.activeElement, select);
      assert.notEqual(engine.compileStack(card, 'compact'), before);
      h.change('room', null);
      assert.deepEqual(h.calls[1].args, { field: 'room', id: null, revision: 2 });
      engine.ipApply(card, { k: 'room', v: null });
      h.push(snapshot(card, 3));
      h.calls[1].resolve(snapshot(card, 3));
      await tick();
      assert.equal(h.host.querySelector('[data-field="room"]').value, '');
      assert.equal(JSON.stringify(engine.app.cards), live);
      assert.equal(JSON.stringify(initial), original);
      h.close();
      assert.equal(h.listeners.size, 0);
      assert.equal(h.host.childNodes.length, 0);
    });
  const card = engine.makeCard('oud');
  await check('newer revision and instrument defeat old completion and rejection', async () => {
    const h = harness(snapshot(card));
    h.change('tuning', 'twelve_tet');
    const newer = snapshot(
      engine.makeCard('banjo_5_string'),
      2,
      'Compact: supplied host explanation.'
    );
    h.push(newer);
    h.doc.querySelector('#outside').focus();
    h.calls[0].reject(Object.assign(new Error('late'), { code: 'STALE' }));
    await tick();
    assert.equal(h.host.querySelector('.ie-source').textContent, newer.sourceMessage);
    assert.equal(h.announcements.length, 0);
    assert.equal(h.doc.activeElement.id, 'outside');
    h.change('room', 'parlor');
    h.push(snapshot(card, 3, 'Rich: supplied host explanation.'));
    h.calls[1].resolve(newer);
    await tick();
    assert.equal(
      h.host.querySelector('.ie-source').textContent,
      'Rich: supplied host explanation.'
    );
    h.close();
  });
  await check('double input, rejected action, STALE and recovery', async () => {
    const h = harness(snapshot(card));
    h.change('room', 'parlor');
    h.change('tuning', 'twelve_tet');
    assert.equal(h.calls.length, 1);
    assert.equal(h.host.querySelector('[data-field="tuning"]').value, '');
    h.calls[0].reject(new Error('network'));
    await tick();
    assert.match(h.host.querySelector('.ie-status').textContent, /Try choosing again/);
    h.change('room', 'parlor');
    h.push(snapshot(card, 2), false);
    h.calls[1].reject({ code: 'STALE' });
    await tick();
    assert.match(h.announcements.at(-1), /Review the current settings/);
    h.change('room', 'parlor');
    assert.equal(h.calls[2].args.revision, 2);
    h.push(snapshot(card, 3));
    h.calls[2].resolve(snapshot(card, 3));
    await tick();
    assert.equal(h.host.querySelector('.ie-status').hidden, true);
    h.close();
  });
  await check('loading/error recovery, text safety and source message replacement', async () => {
    const h = harness(freeze({ status: 'loading', error: null, instrumentId: 'oud', revision: 0 }));
    h.handle.focus();
    assert.equal(h.doc.activeElement.className, 'ie-status');
    h.push(
      freeze({
        status: 'error',
        error: { code: 'LOAD', message: '<img onerror=x> unavailable' },
        instrumentId: 'oud',
        revision: 1,
      })
    );
    assert.equal(h.host.querySelector('img'), null);
    assert.match(h.host.textContent, /<img onerror=x>/);
    h.push(snapshot(card, 2, 'Nothing about a format is inferred here.'));
    assert.equal(
      h.host.querySelector('.ie-source').textContent,
      'Nothing about a format is inferred here.'
    );
    assert.equal(h.host.querySelector('.ie-fields').hidden, false);
    const link = h.host.querySelector('link');
    assert.equal(link.rel, 'stylesheet');
    assert.ok(link.href.endsWith('/instrument-environment/environment.css'));
    h.close();
    assert.equal(link.isConnected, false);
  });
  await check('abort, unmount and pre-aborted mount', async () => {
    for (const abort of [true, false]) {
      const h = harness(snapshot(card));
      h.change('room', 'parlor');
      if (abort) h.controller.abort();
      else h.handle.unmount();
      h.calls[0].reject(new Error('late'));
      h.push(snapshot(card, 9));
      await tick();
      assert.equal(h.host.childNodes.length, 0);
      assert.equal(h.listeners.size, 0);
      assert.equal(h.announcements.length, 0);
      h.handle.focus();
      h.close();
    }
    const h = harness(snapshot(card), true);
    assert.equal(h.host.childNodes.length, 0);
    assert.equal(h.listeners.size, 0);
    h.close();
  });
  await check('two mounts have independent lifetime and styles', async () => {
    const a = harness(snapshot(card)),
      b = harness(snapshot(card));
    a.close();
    assert.equal(b.host.querySelectorAll('link').length, 1);
    b.change('room', 'parlor');
    assert.equal(b.calls.length, 1);
    b.close();
    b.calls[0].resolve(snapshot(card));
    await tick();
  });
  await check('loading recovery restores the prior field without stealing focus', async () => {
    const h = harness(snapshot(card));
    const room = h.host.querySelector('[data-field="room"]');
    room.focus();
    h.push(freeze({ status: 'loading', instrumentId: 'oud', revision: 2, error: null }));
    assert.equal(h.doc.activeElement.className, 'ie-status');
    h.push(snapshot(card, 3));
    assert.equal(h.doc.activeElement, room);
    h.push(freeze({ status: 'loading', instrumentId: 'oud', revision: 4, error: null }));
    h.doc.querySelector('#outside').focus();
    h.push(snapshot(card, 5));
    assert.equal(h.doc.activeElement.id, 'outside');
    h.close();
  });
  await check('same-instrument revision supersedes a pending rejection', async () => {
    const h = harness(snapshot(card));
    h.change('room', 'parlor');
    h.push(snapshot(card, 2));
    h.calls[0].reject(new Error('superseded failure'));
    await tick();
    assert.equal(h.announcements.length, 0);
    assert.equal(h.host.querySelector('.ie-status').hidden, true);
    h.close();
  });
  console.log(
    `${cases} cases passed; 18 pinned source blobs; canonical 122/256 options. DOM contract evidence only.`
  );
  if (process.argv.includes('--mutations')) {
    const mutations = [
      ['unsafe message markup', 'source.textContent = ready', 'source.innerHTML = ready'],
      ['reversed canonical options', '...field.options]', '...[...field.options].reverse()]'],
      ['empty string instead of null', 'select.value || null', 'select.value'],
      ['wrong action revision', 'revision: action.revision', 'revision: 0'],
      ['duplicate pending action', 'if (pending) {', 'if (false && pending) {'],
      ['subscription leak', '    unsubscribe();', '    // unsubscribe omitted'],
      ['lost recovery focus', 'if (restoreFocus)', 'if (false && restoreFocus)'],
      ['old revision remains pending', 'next.revision !== pending.revision', 'false'],
    ];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'environment-mutations-'));
    try {
      for (const [name, before, after] of mutations) {
        assert.ok(source.includes(before), `Mutation anchor missing: ${name}`);
        const file = path.join(dir, 'environment.js');
        fs.writeFileSync(file, source.replace(before, after));
        const result = spawnSync(process.execPath, [__filename], {
          env: { ...process.env, ENVIRONMENT_FEATURE_FILE: file },
          encoding: 'utf8',
          timeout: 30000,
        });
        assert.equal(result.error, undefined, name);
        assert.notEqual(result.status, 0, `Mutation survived: ${name}`);
        assert.match(result.stderr, /AssertionError/, `Not an assertion failure: ${name}`);
        console.log(`KILLED ${name}`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

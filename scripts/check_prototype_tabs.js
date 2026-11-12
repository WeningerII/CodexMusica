#!/usr/bin/env node
'use strict';
// Actual tab controller and host under jsdom; lane/load doubles. Also executes
// the shell's actual preview contexts with distinct contract-double ports.
// Native keyboard activation, layout, real engine and AT remain browser gates.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('acorn');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const url = (s) => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const tick = () => new Promise((r) => setImmediate(r));
async function exercise(source, hostSource = read('prototype/host.js')) {
  const dom = new JSDOM(
    '<p id="proto-status"></p><section><h1 tabindex="-1">Instrument</h1></section>',
    { url: 'https://prototype.example/prototype/' }
  );
  const old = {};
  for (const key of ['window', 'document', 'AbortController', 'localStorage']) {
    old[key] = global[key];
    global[key] = dom.window[key];
  }
  const { document } = dom.window;
  let tabs;
  try {
    const { createTabs } = await import(url(source));
    const { createHost } = await import(
      url(hostSource.replace("'./storage.js'", JSON.stringify(url(read('prototype/storage.js')))))
    );
    const mounted = [],
      contexts = [],
      unmounted = [],
      loads = [];
    let release;
    const module = (id) => ({
      mount(host, ctx) {
        mounted.push(id);
        contexts.push(ctx);
        host.textContent = id;
        return {
          unmount() {
            unmounted.push(id);
          },
          focus() {
            throw Error('tab must keep focus');
          },
        };
      },
    });
    const lanes = ['parts', 'character', 'output'].map((id) => ({
      id,
      tab: id,
      label: id,
      unloaded: 'Load failed.',
      context: async () => ({}),
      load: () => {
        loads.push(id);
        return id === 'character'
          ? new Promise((r) => {
              release = () => r(module(id));
            })
          : Promise.resolve(module(id));
      },
    }));
    tabs = createTabs(document.querySelector('section'), lanes, createHost);
    const buttons = [...document.querySelectorAll('[role="tab"]')];
    const regions = [...document.querySelectorAll('[role="tabpanel"]')];
    assert.equal(loads.length, 0, 'startup is lazy');
    assert.equal(buttons.length, 3);
    for (let i = 0; i < 3; i++) {
      assert.equal(buttons[i].getAttribute('aria-controls'), regions[i].id);
      assert.equal(regions[i].getAttribute('aria-labelledby'), buttons[i].id);
    }
    tabs.show();
    await tick();
    assert.deepEqual(loads, ['parts']);
    buttons[0].focus();
    buttons[0].dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      })
    );
    assert.equal(document.activeElement, buttons[1]);
    assert.equal(buttons[0].getAttribute('aria-selected'), 'true', 'arrows do not activate');
    assert.deepEqual(loads, ['parts']);
    buttons[1].click();
    await tick();
    buttons[2].focus();
    buttons[2].click();
    await tick();
    release();
    await tick();
    assert.equal(document.activeElement, buttons[2], 'late mount does not steal focus');
    assert.deepEqual(
      regions.map((p) => p.hidden),
      [true, true, false]
    );
    assert.deepEqual(
      buttons.map((b) => b.getAttribute('aria-selected')),
      ['false', 'false', 'true']
    );
    buttons[1].click();
    await tick();
    buttons[1].click();
    await tick();
    assert.equal(loads.filter((id) => id === 'character').length, 1, 'reselect keeps mount');
    buttons[2].dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    assert.equal(document.activeElement, buttons[0], 'arrows wrap');
    buttons[0].dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true })
    );
    assert.equal(document.activeElement, buttons[2]);
    buttons[2].dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true })
    );
    assert.equal(document.activeElement, buttons[0]);
    const outer = document.querySelector('section');
    const sibling = createHost(
      {
        id: 'sibling',
        label: 'Sibling',
        context: async () => ({}),
        load: async () => ({
          mount() {
            return { unmount() {} };
          },
        }),
      },
      outer
    );
    await sibling.show();
    assert.equal(
      document.querySelector('[data-feature-host="sibling"]').parentElement,
      outer,
      'sibling host never enters a tab'
    );
    sibling.unmount();
    tabs.unmount();
    assert.equal(document.querySelector('[role="tablist"]'), null);
    assert.equal(unmounted.length, 3);
    assert.ok(contexts.every((ctx) => ctx.signal.aborted));
    buttons[0].click();
    tabs.show();
    await tick();
    assert.equal(loads.length, 3, 'disposed tabs cannot reopen');
    assert.equal(mounted.length, 3);
  } finally {
    tabs?.unmount();
    dom.window.close();
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  }
}
function init(source, name) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  for (const n of ast.body) {
    const d = n.declaration || n;
    if (d.type === 'VariableDeclaration') {
      const v = d.declarations.find((v) => v.id.name === name);
      if (v) return v.init;
    }
  }
  throw Error(`Missing ${name}`);
}
async function contexts(source) {
  const spec = [
    ['instrumentparts', 'configuration', ['choosePart', 'snapshot', 'subscribe']],
    [
      'instrumentcharacter',
      'character',
      ['automatic', 'choose', 'normalize', 'snapshot', 'subscribe'],
    ],
    ['instrumentenvironment', 'environment', ['choose', 'snapshot', 'subscribe']],
    ['instrumentsignal', 'chain', ['choose', 'snapshot', 'subscribe']],
  ];
  const node = init(source, 'MORE').properties.find((p) => p.key.name === 'instrument').value;
  const ending = init(source, 'ending');
  const host = await import(
    url(
      read('prototype/host.js').replace(
        "'./storage.js'",
        JSON.stringify(url(read('prototype/storage.js')))
      )
    )
  );
  let ready = false,
    release;
  const pending = new Promise((r) => {
    release = r;
  });
  const listeners = new Set(),
    calls = [];
  const preview = Object.fromEntries(
    spec.map(([, field, keys]) => [
      field,
      Object.fromEntries(
        keys.map((key) => [
          key,
          key === 'snapshot'
            ? () => field
            : key === 'subscribe'
              ? (fn) => {
                  listeners.add(fn);
                  return () => listeners.delete(fn);
                }
              : (...args) => calls.push([field, key, ...args]),
        ])
      ),
    ])
  );
  const recipe = { preview, start: () => pending, status: () => (ready ? 'ready' : 'error') };
  const list = vm.runInNewContext(
    `const ending = ${source.slice(ending.start, ending.end)}; (${source.slice(node.start, node.end)})`,
    { recipe, untilAborted: host.untilAborted }
  );
  let settled = 0;
  const controllers = spec.map(() => new AbortController());
  const work = spec.map(([id], i) =>
    list
      .find((l) => l.id === id)
      .context({ signal: controllers[i].signal })
      .then((v) => {
        settled++;
        return v;
      })
  );
  await Promise.resolve();
  assert.equal(settled, 0);
  ready = true;
  release();
  const views = await Promise.all(work);
  let heard = 0;
  views.forEach((ctx, i) => {
    const [, field, keys] = spec[i];
    assert.deepEqual(Object.keys(ctx), [field]);
    assert.deepEqual(Object.keys(ctx[field]).sort(), keys);
    assert.equal(ctx[field].snapshot(), field, 'correct preview identity');
    for (const key of keys.filter((k) => !['snapshot', 'subscribe'].includes(k))) {
      const arg = { revision: 7 };
      ctx[field][key](arg);
      assert.deepEqual(calls.pop(), [field, key, arg]);
    }
    ctx[field].subscribe(() => heard++);
  });
  for (const fn of listeners) fn();
  assert.equal(heard, 4);
  controllers.forEach((c) => c.abort());
  assert.equal(listeners.size, 0);
  views.forEach((ctx, i) => ctx[spec[i][1]].subscribe(() => heard++));
  assert.equal(listeners.size, 0);
  ready = false;
  for (const [id] of spec)
    await assert.rejects(
      list.find((l) => l.id === id).context({ signal: new AbortController().signal }),
      /not ready/
    );
}
async function check() {
  const source = read('prototype/tabs.js');
  await exercise(source);
  const mutants = [
    ['hidden selection', 'region.hidden = active !== i;', 'region.hidden = false;'],
    ['missing ARIA selection', "tab.setAttribute('aria-selected', String(active === i));", ''],
    ['missing disposal', 'host.unmount();', ''],
  ];
  for (const [name, from, to] of mutants) {
    assert.ok(source.includes(from));
    await assert.rejects(exercise(source.replaceAll(from, to)), undefined, name);
  }
  await assert.rejects(
    exercise(
      source,
      read('prototype/host.js').replace(
        "[...panel.children].filter((node) => node.hasAttribute('data-feature-host'))",
        "panel.querySelectorAll('[data-feature-host]')"
      )
    ),
    undefined,
    'nested host placement'
  );
  const app = read('prototype/app.js');
  await contexts(app);
  for (const view of ['configuration', 'character', 'environment', 'chain']) {
    const from = `${view}: ending(signal, recipe.preview.${view})`;
    assert.ok(app.includes(from));
    await assert.rejects(
      contexts(app.replace(from, `${view}: recipe.preview.${view}`)),
      undefined,
      `${view} lifetime`
    );
  }
  console.log(
    'tabs: actual controller/host DOM controls and four preview contexts pass; 8 causal mutants rejected; lane/store doubles, no browser/AT'
  );
}
module.exports = { check };
if (require.main === module)
  check().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

// #670 isolated contract checks, NOT engine/Undo or integrated-shell evidence.
// Source: main fd16719d46217adc9b57ef939c9497e29e77741c, genre.js
// 47078396261039a6d18e97edbe1c242d2b440f80; 02_instruments.js
// 0f67d61306b2a96bd005c7c01e34c52afd70357f; 05_traditions.js
// f8b910676eac35dcaf8ec00e5e5b531a40fb91c0. IDs/names/order below are exact.
// Default: deliberately small DOM double, no layout/accessibility-tree claim.
// --browser: the same interactions in sandboxed Chromium; startup failures fail.
// --mutation=ensemble|destination|stale-load|cleanup|note tests attribution by
// requiring the named assertion, never accepting setup errors as caught faults.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const http = require('node:http');
const feature = path.resolve(__dirname, '../../features/genre-instruments/instruments.js');
const css = fs.readFileSync(feature.replace(/\.js$/, '.css'), 'utf8');
let source = fs.readFileSync(feature, 'utf8');
const fixture = {
  bluegrass: {
    id: 'bluegrass',
    name: 'Bluegrass',
    instruments: [
      ['acoustic_guitar_dread', 'Dreadnought acoustic guitar'],
      ['mandolin', 'Mandolin'],
      ['banjo_5_string', 'Five-string banjo'],
      ['upright_bass', 'Upright (double) bass'],
      ['fiddle', 'Fiddle'],
      ['mandola', 'Mandola (alto mandolin)'],
    ],
  },
  ambient: {
    id: 'ambient',
    name: 'Ambient',
    instruments: [
      ['analog_synth', 'Analog synthesizer (subtractive)'],
      ['tape_replay_keyboard', 'Tape-replay polyphonic keyboard'],
      ['handpan', 'Handpan (steel tongue drum)'],
      ['cristal_baschet', 'Cristal Baschet (glass-rod friction idiophone)'],
    ],
  },
};
// Media availability doubles: null exercises the explicit unavailable contract;
// the complete production SVG stores were checked separately by the source oracle.
// Listen uses a reserved test host, with the real production query; no external launch.
for (const f of Object.values(fixture)) {
  f.instruments = f.instruments.map(([id, name]) => ({
    id,
    name,
    glyphUrl: null,
    listenHref: null,
  }));
}
fixture.bluegrass.instruments[0].listenHref =
  'https://listen.test/results?search_query=Dreadnought%20acoustic%20guitar%20musical%20instrument%20solo%20demonstration';

async function exercise(doc, mount, fixtures) {
  let passed = 0;
  const check = (value, message) => {
    if (!value) throw Error(message);
    passed++;
  };
  const freeze = (value) => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  freeze(fixtures);
  const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    return { promise, resolve, reject };
  };
  let selected = 'bluegrass';
  let snapshot = freeze({
    status: 'ready',
    busy: false,
    revision: 1,
    groups: [{ genreId: 'ambient', name: 'Ambient', count: 1 }],
  });
  const listeners = { genre: new Set(), recipe: new Set() };
  const saved = new Map();
  const calls = [],
    inspections = [],
    loads = [];
  let request, nextLoad;
  const host = doc.createElement('main');
  doc.body.append(host);
  const ctx = {
    storage: {
      read: (key) => ({ ok: true, value: saved.get(key) ?? null }),
      write: (key, value) => {
        saved.set(key, structuredClone(value));
        return { ok: true };
      },
    },
    genre: {
      current: () => selected,
      subscribe: (fn) => {
        listeners.genre.add(fn);
        return () => listeners.genre.delete(fn);
      },
    },
    loadGenreInstruments: (id, { signal }) => {
      loads.push({ id, signal });
      const result = nextLoad;
      nextLoad = null;
      return result ? result.promise : Promise.resolve(fixtures[id]);
    },
    openInstrument: (id, options) => inspections.push({ id, ...options }),
    recipe: {
      snapshot: () => snapshot,
      subscribe: (fn) => {
        listeners.recipe.add(fn);
        return () => listeners.recipe.delete(fn);
      },
      addInstrument: (args) => {
        calls.push({ kind: 'single', ...args });
        return request ? request.promise : Promise.resolve({ snapshot, placed: 'independent' });
      },
      addEnsemble: (args) => {
        calls.push({ kind: 'ensemble', ...args });
        return Promise.resolve({ snapshot, added: 6, placed: 'grouped' });
      },
    },
    announce: () => {
      throw Error('duplicate announcement');
    },
  };
  const emit = (kind) => [...listeners[kind]].forEach((fn) => fn());
  const chooseGenre = async (id) => {
    selected = id;
    emit('genre');
    await wait();
  };
  const all = (selector) => [...host.querySelectorAll(selector)];
  const one = (selector) => all(selector)[0];
  const choose = async (value) => {
    const s = one('select');
    s.value = value;
    s.dispatchEvent(new doc.defaultView.Event('change'));
    await wait();
  };
  const publish = (changes) => {
    snapshot = freeze({ ...snapshot, ...changes });
    emit('recipe');
  };
  let dispose = mount(host, ctx);
  await wait();
  check(
    all('link').length === 1 && one('link').href.endsWith('/instruments.css'),
    'stylesheet attached'
  );
  check(
    all('.gi-inspect')
      .map((x) => x.textContent)
      .join('|') === fixtures.bluegrass.instruments.map((x) => x.name).join('|'),
    'ordered full roster'
  );
  check(all('.gi-add').length === 6, 'all six additions');
  check(
    all('option')
      .map((x) => x.value)
      .join('|') === 'bluegrass|ambient|',
    'destination order'
  );
  check(one('select').value === 'bluegrass', 'source default');
  check(
    one('.gi-note').textContent.includes('(the group is created)'),
    'absent source group valid'
  );
  check(one('label').htmlFor === one('select').id, 'label association');
  check(one('select').getAttribute('aria-describedby') === one('.gi-note').id, 'note association');
  check(one('.gi-note').getAttribute('aria-live') === 'polite', 'polite note');
  check(all('a').length === 1 && all('.gi-unavailable').length === 5, 'unavailable listen');
  check(one('a').href === fixtures.bluegrass.instruments[0].listenHref, 'native listen target');
  check(
    one('a').rel === 'noopener noreferrer' && one('a').target === '_blank',
    'native listen protection'
  );
  const inspect = one('.gi-inspect');
  inspect.click();
  check(
    inspections[0].id === 'acoustic_guitar_dread' && inspections[0].returnFocus === inspect,
    'inspect route and focus'
  );
  await choose('ambient');
  check(
    one('.gi-add').getAttribute('aria-label') === 'Add Dreadnought acoustic guitar to Ambient',
    'destination label immediate'
  );
  publish({ revision: 2 });
  await wait(340);
  check(
    one('.gi-note').textContent === 'Joins the Ambient group in Your recipe.',
    'debounced note survives update'
  );
  const button = one('.gi-add');
  button.focus();
  request = deferred();
  button.click();
  button.click();
  check(calls.length === 1, 'pending duplicate blocked');
  check(calls[0].destination === 'ambient' && calls[0].revision === 2, 'destination command');
  check(button.getAttribute('aria-disabled') === 'true', 'pending accessible state');
  check(doc.activeElement === button, 'pending focus retained');
  publish({ revision: 3 });
  request.resolve({ snapshot: { ...snapshot, revision: 0 }, placed: 'independent' });
  await wait();
  request = null;
  check(doc.activeElement === button && one('.gi-add') === button, 'settled focus retained');
  button.click();
  await wait();
  check(calls.length === 2 && calls[1].revision === 3, 'repeat and authoritative revision');
  await choose('');
  button.click();
  await wait();
  check(calls.at(-1).destination === null, 'independent null');
  one('.gi-ensemble').click();
  await wait();
  check(
    calls.at(-1).kind === 'ensemble' && calls.at(-1).genreId === 'bluegrass',
    'ensemble source'
  );
  check(
    snapshot.groups.length === 1 && snapshot.groups[0].genreId === 'ambient',
    'no local recipe mutation'
  );
  dispose();
  check(all('link').length === 0 && host.children.length === 0, 'cleanup root');
  check(listeners.genre.size === 0 && listeners.recipe.size === 0, 'cleanup subscriptions');
  dispose = mount(host, ctx);
  await wait();
  check(one('select').value === '', 'remount independent');
  await choose('ambient');
  dispose();
  dispose = mount(host, ctx);
  await wait();
  check(one('select').value === 'ambient', 'remount grouped');
  publish({ status: 'loading', groups: [] });
  check(
    one('select').value === 'ambient' && !host.textContent.includes('undefined'),
    'loading saved destination'
  );
  check(saved.get('destinations').bluegrass === 'ambient', 'loading preserves storage');
  check(one('.gi-add').getAttribute('aria-disabled') === 'true', 'loading blocks additions');
  publish({ status: 'ready', groups: [], revision: 4 });
  publish({ busy: true, revision: 5 });
  await wait(340);
  check(one('select').value === 'bluegrass', 'removed destination fallback');
  check(
    one('.gi-note').textContent.includes('previous destination'),
    'removed note survives update'
  );
  check(saved.get('destinations').bluegrass === 'bluegrass', 'fallback persisted');
  let count = calls.length;
  one('.gi-add').click();
  check(calls.length === count, 'host busy blocked');
  publish({ busy: false });
  for (const code of ['STALE', 'BUSY', 'LOAD_FAILED']) {
    request = deferred();
    one('.gi-add').click();
    request.reject(Object.assign(Error(code), { code }));
    await wait();
    request = null;
    check(one('.gi-add').getAttribute('aria-disabled') === 'false', `${code} recovers`);
  }
  const oldAdd = one('.gi-add'),
    oldInspect = one('.gi-inspect');
  await chooseGenre('ambient');
  count = calls.length;
  oldAdd.click();
  oldInspect.click();
  check(calls.length === count && inspections.length === 1, 'stale buttons inert');
  check(
    all('.gi-inspect').length === 4 &&
      one('.gi-inspect').textContent === fixtures.ambient.instruments[0].name,
    'second real fixture'
  );
  const slow = deferred();
  nextLoad = slow;
  selected = 'bluegrass';
  emit('genre');
  const slowSignal = loads.at(-1).signal;
  await chooseGenre('ambient');
  slow.resolve(fixtures.bluegrass);
  await wait();
  check(
    one('.gi-inspect').textContent === fixtures.ambient.instruments[0].name,
    'stale load ignored'
  );
  check(slowSignal.aborted, 'previous load aborted');
  nextLoad = deferred();
  const failed = nextLoad;
  selected = 'bluegrass';
  emit('genre');
  failed.reject(Error('Could not load genre.'));
  await wait();
  check(host.textContent.includes('Could not load genre.'), 'load failure shown');
  one('button').click();
  await wait();
  check(all('.gi-add').length === 6, 'retry loads');
  publish({ groups: [{ genreId: 'bluegrass', name: 'Bluegrass', count: 1 }] });
  check(one('.gi-ensemble').textContent.endsWith('again'), 'repeat ensemble label');
  const retainedGenre = [...listeners.genre][0],
    retainedRecipe = [...listeners.recipe][0],
    retainedInspect = one('.gi-inspect');
  const inflight = deferred();
  nextLoad = inflight;
  selected = 'ambient';
  emit('genre');
  const finalSignal = loads.at(-1).signal;
  dispose();
  const loadCount = loads.length;
  retainedGenre();
  retainedRecipe();
  retainedInspect.click();
  inflight.resolve(fixtures.ambient);
  await wait();
  check(loads.length === loadCount && inspections.length === 1, 'disposed callbacks inert');
  check(finalSignal.aborted, 'dispose aborts load');
  check(host.children.length === 0, 'late result cannot remount');
  selected = null;
  dispose = mount(host, ctx);
  await wait();
  check(host.textContent.includes('Choose a genre'), 'selection prompt');
  dispose();
  host.remove();
  return passed;
}

// Only the DOM operations used above; no CSS, layout, native focus or a11y proof.
function domDouble() {
  class Element {
    constructor(tag, doc) {
      this.tagName = tag;
      this.ownerDocument = doc;
      this.children = [];
      this.attributes = {};
      this.events = {};
      this._text = '';
      this.className = '';
    }
    append(...nodes) {
      for (const n of nodes) {
        n.parentNode = this;
        this.children.push(n);
      }
    }
    replaceChildren(...nodes) {
      this.children.forEach((n) => {
        n.parentNode = null;
      });
      this.children = [];
      this._text = '';
      this.append(...nodes);
    }
    remove() {
      if (this.parentNode) {
        this.parentNode.children = this.parentNode.children.filter((n) => n !== this);
        this.parentNode = null;
      }
    }
    set textContent(v) {
      this.replaceChildren();
      this._text = v;
    }
    get textContent() {
      return this._text + this.children.map((n) => n.textContent).join('');
    }
    setAttribute(k, v) {
      this.attributes[k] = v;
    }
    getAttribute(k) {
      return this.attributes[k] ?? null;
    }
    addEventListener(k, fn) {
      (this.events[k] ||= []).push(fn);
    }
    dispatchEvent(e) {
      for (const fn of this.events[e.type] || []) fn(e);
    }
    click() {
      if (!this.disabled) this.dispatchEvent({ type: 'click' });
    }
    focus() {
      this.ownerDocument.activeElement = this;
    }
    querySelectorAll(s) {
      const found = [];
      for (const child of this.children) {
        if (s[0] === '.' ? child.className.split(' ').includes(s.slice(1)) : child.tagName === s)
          found.push(child);
        found.push(...child.querySelectorAll(s));
      }
      return found;
    }
  }
  const doc = {
    defaultView: {
      Event: class {
        constructor(type) {
          this.type = type;
        }
      },
    },
    createElement(tag) {
      return new Element(tag, this);
    },
  };
  doc.body = doc.createElement('body');
  return doc;
}
const mutations = {
  ensemble: [
    'ctx.recipe.addEnsemble({ genreId, revision })',
    'ctx.recipe.addEnsemble({ genreId: destination, revision })',
    'ensemble source',
  ],
  destination: [
    'destination, revision });',
    'destination: null, revision });',
    'destination command',
  ],
  'stale-load': [
    'if (!alive || version !== generation) return;',
    'if (!alive) return;',
    'stale load ignored',
  ],
  cleanup: ['unsubscribeGenre();', '// unsubscribeGenre();', 'cleanup subscriptions'],
  note: [
    'if (removed) removedDestination = true;',
    'if (removed) removedDestination = false;',
    'removed note survives update',
  ],
};
async function main() {
  const mutation = process.argv.find((a) => a.startsWith('--mutation='))?.split('=')[1];
  if (mutation) {
    assert(mutations[mutation], 'unknown mutation');
    const [from, to] = mutations[mutation];
    assert(source.includes(from), 'mutation target missing');
    source = source.replace(from, to);
  }
  let run;
  if (process.argv.includes('--browser')) {
    const { chromium } = require('playwright');
    const server = http.createServer((req, res) => {
      res.setHeader(
        'Content-Type',
        req.url.endsWith('.css')
          ? 'text/css'
          : req.url.endsWith('.js')
            ? 'text/javascript'
            : 'text/html'
      );
      res.end(
        req.url.endsWith('.js')
          ? source
          : req.url.endsWith('.css')
            ? css
            : '<!doctype html><meta name="viewport" content="width=device-width"><body></body>'
      );
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        chromiumSandbox: true,
        ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      });
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(async () => {
        globalThis.lane = await import('/instruments.js');
      });
      run = async () => {
        let total = 0;
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 900 });
          total += await page.evaluate(
            async ({ code, fixtures }) => {
              const test = (0, eval)(`(${code})`);
              return test(document, globalThis.lane.mount, fixtures);
            },
            { code: exercise.toString(), fixtures: fixture }
          );
        }
        return total;
      };
      await verdict(run, mutation);
    } finally {
      await browser?.close();
      await new Promise((r) => server.close(r));
    }
  } else {
    const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout });
    vm.runInContext(
      source
        .replace('export function mount', 'function mount')
        .replace('import.meta.url', "'file:///lane/instruments.js'"),
      context
    );
    run = () => exercise(domDouble(), context.mount, structuredClone(fixture));
    await verdict(run, mutation);
  }
}
async function verdict(run, mutation) {
  try {
    const count = await run();
    assert(!mutation, `mutation survived: ${mutation}`);
    console.log(
      `${count} isolated contract assertions passed (${process.argv.includes('--browser') ? 'browser' : 'DOM double'}); integration pending`
    );
  } catch (error) {
    if (mutation && error.message === mutations[mutation][2])
      console.log(`mutation ${mutation}: caught by ${error.message}`);
    else throw error;
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

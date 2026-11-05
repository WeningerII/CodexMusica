'use strict';
// Standalone real-source + DOM/browser fixture qualification, NOT shell integration.
// CHARACTER_SOURCE_ROOT must contain the 18 pinned production files below.
// node character.cjs --dom : source/DOM/mutation tests
// node character.cjs       : same plus sandboxed Chromium browser tests
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const http = require('node:http');
const { chromium } = require('playwright');
const HEAD = 'fd16719d46217adc9b57ef939c9497e29e77741c';
const PINS = {
  'src/app.js': '18578a05ee3b4e0cf36d59fc733d8894901f4adb',
  'src/pages/instrument.js': '3124f657ed00167c440651d905fadacd5453954b',
  'scripts/_loader.js': '7c8b0a104617b019d60b63aa16b45062c6872fff',
  'scripts/_load_app.js': '67f0ebf8c16a3a6996626ed134ceed599008a33d',
  'scripts/_card_descriptors.js': '38508947b4d99bf33a9c6d614d697831bd47bf8f',
  'scripts/_merge.js': '971a36572bc8497d1033d7628d4826b22739d6a6',
  'scripts/_recipe_stack.js': '4c28f906c19eaa7511331d17574fccd5854403dc',
  'references/_tradition_aliases.json': '1aa692e7a3405be1a74bf87fcc7b3df08e117f21',
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
};
const featurePath = path.resolve(__dirname, '../../features/instrument-character/character.js');
const cssPath = path.resolve(__dirname, '../../features/instrument-character/character.css');
const feature = fs.readFileSync(featurePath, 'utf8');
const clone = (x) => JSON.parse(JSON.stringify(x));
const freeze = (x) => {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.values(x).forEach(freeze);
    Object.freeze(x);
  }
  return x;
};
let checks = 0;
let canonicalNormalize;
function check(value, label) {
  assert.ok(value, label);
  checks++;
}
function fixtures() {
  const root = process.env.CHARACTER_SOURCE_ROOT || path.resolve(__dirname, '../../..', '..');
  for (const [file, sha] of Object.entries(PINS)) {
    const bytes = fs.readFileSync(path.join(root, file));
    const actual = crypto
      .createHash('sha1')
      .update(Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes]))
      .digest('hex');
    assert.equal(actual, sha, file + ' must match ' + HEAD);
  }
  const C = require(path.join(root, 'scripts/_loader.js'));
  const filename = path.join(root, 'scripts/_load_app.js');
  const loader = new Module(filename, module);
  loader.filename = filename;
  loader.paths = module.paths;
  loader._compile(
    fs
      .readFileSync(filename, 'utf8')
      .replace(
        'const EXPORTED = [',
        "const EXPORTED = ['Inst','prefaceGroups','PREFACE_CAT_ORDER','compileStack','prefaceGlyphsHTML','normalizeSearch',"
      ),
    filename
  );
  const A = loader.exports.loadApp();
  const deps = { ...A, Engine: { onSettle() {} }, uiRegisterPage() {} };
  const ipApply = new Function(
    ...Object.keys(deps),
    fs.readFileSync(path.join(root, 'src/pages/instrument.js'), 'utf8') + '\nreturn ipApply;'
  )(...Object.values(deps));
  canonicalNormalize = A.normalizeSearch;
  const svgURLs = (html) =>
    [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(
      ([svg]) =>
        'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))
    );
  const categories = A.PREFACE_CAT_ORDER.map((id) => ({
    id,
    name: id,
    prefaces: A.prefaceGroups()[id].map((e) => {
      const pair = svgURLs(A.prefaceGlyphsHTML(e, 15, false));
      const entry = svgURLs(A.prefaceGlyphsHTML(e, 15, true));
      return {
        id: e.id,
        note: e.note || null,
        glyph: {
          category: pair.length > entry.length ? pair[0] : null,
          entry: entry[0] || null,
        },
      };
    }),
  }));
  check(
    categories.length === 16 && categories.flatMap((c) => c.prefaces).length === 740,
    'real catalog'
  );
  const sourceCases = [
    ['oud', 'dream-floating', null],
    ['voice', 'bitter', null],
    ['grand_piano', 'haunting', null],
    ['banjo_5_string', 'dream-floating', 'bluegrass'],
  ];
  A.app.cards.push(A.makeCard('voice', A.traditionCardOpts('bluegrass', 'voice')));
  const formats = ['rich', 'tags', 'prose', 'compact'];
  const recipe = formats.map((f) => A.compileRecipeStack(A.app.cards, f));
  const rows = sourceCases.map(([id, choice, tradition]) => {
    const card = A.makeCard(id, tradition ? A.traditionCardOpts(tradition, id) : undefined);
    const snap = (revision) =>
      freeze({
        status: 'ready',
        error: null,
        instrumentId: id,
        revision,
        categories,
        current: card.preface,
        automatic: card.prefaceAuto,
        suggestion: A.suggestPrefaceForCard(card),
      });
    const before = snap(1);
    const beforeText = formats.map((f) => A.compileStack(card, f));
    const part = A.Inst(id).parts.find((p) => card.parts[p.id]);
    A.applyPartEdit(card, part.id, { quiet: true });
    check(card.pinnedParts.includes(part.id), id + ' real pin');
    ipApply(card, { k: 'preface', id: choice });
    const picked = snap(2);
    check(card.preface === choice && card.prefaceAuto === false, id + ' character selected');
    check(card.pinnedParts.length === 0, id + ' pins cleared');
    const afterText = formats.map((f) => A.compileStack(card, f));
    check(beforeText[0] !== afterText[0], id + ' canonical preview changed');
    const config = clone({
      parts: card.parts,
      room: card.room,
      tuning: card.tuning,
      chain: card.chain,
    });
    ipApply(card, { k: 'auto' });
    const automatic = snap(3);
    assert.deepEqual(
      { parts: card.parts, room: card.room, tuning: card.tuning, chain: card.chain },
      config
    );
    check(automatic.automatic, id + ' automatic mode');
    return { before, picked, automatic, choice, beforeText, afterText };
  });
  assert.deepEqual(
    formats.map((f) => A.compileRecipeStack(A.app.cards, f)),
    recipe
  );
  check(true, 'real nonempty recipe untouched');
  const blank = A.makeCard('microtonal_guitar_unspecified');
  check(blank.preface === null, 'real null character');
  return {
    rows,
    categories,
    noCharacter: freeze({
      status: 'ready',
      error: null,
      instrumentId: blank.instrumentId,
      revision: 1,
      categories,
      current: null,
      automatic: true,
      suggestion: null,
    }),
    catalog: C.PREFACE_LEXICON.length,
    normalizeSource: A.normalizeSearch.toString(),
  };
}

// Deliberately controlled scheduling around real engine-produced snapshots.
// The fixture adapter is not the shell adapter or a reimplementation of the engine.
function controlled(initial) {
  let value = initial;
  const subscribers = new Set();
  const pending = [];
  const calls = [];
  const normalizations = [];
  const api = Object.freeze({
    normalize: (text) => {
      normalizations.push(text);
      return canonicalNormalize(text);
    },
    snapshot: () => value,
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    choose(args) {
      return dispatch('choose', args);
    },
    automatic(args) {
      return dispatch('automatic', args);
    },
  });
  function dispatch(type, args) {
    calls.push({ type, ...args });
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  }
  return {
    api,
    pending,
    calls,
    normalizations,
    subscribers,
    publish(next) {
      value = freeze(next);
      subscribers.forEach((fn) => fn());
    },
  };
}

async function domHarness(
  source,
  initial,
  {
    refuse = false,
    prior = null,
    aborted = false,
    abortOnRead = false,
    abortOnWrite = false,
    abortOnAnnounce = false,
  } = {}
) {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(
    '<main><div id="a"></div><div id="b"></div><button id="outside">Outside</button></main>',
    {
      url: 'http://localhost/prototype/',
    }
  );
  const win = dom.window;
  // Only module plumbing changes for this DOM-only run. Browser run imports the ES module.
  const mount = new Function(
    'AbortController',
    'URL',
    '__moduleURL',
    source
      .replace('export function mount', 'function mount')
      .replaceAll('import.meta.url', '__moduleURL') + '\nreturn mount;'
  )(
    win.AbortController,
    win.URL,
    'http://localhost/prototype/features/instrument-character/character.js'
  );
  const adapter = controlled(initial);
  const messages = [];
  const writes = [];
  const controller = new win.AbortController();
  if (aborted) controller.abort();
  const storage = {
    read: () => {
      if (abortOnRead) controller.abort();
      return { ok: true, value: prior };
    },
    write(key, value) {
      if (abortOnWrite) controller.abort();
      writes.push([key, clone(value)]);
      return { ok: !refuse };
    },
  };
  const host = win.document.getElementById('a');
  const ctx = Object.freeze({
    character: adapter.api,
    storage,
    announce: (s) => {
      messages.push(s);
      if (abortOnAnnounce) controller.abort();
    },
    signal: controller.signal,
  });
  const handle = mount(host, ctx);
  return { dom, win, mount, adapter, messages, writes, controller, storage, host, handle, ctx };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const q = (h, selector) => h.host.querySelector(selector);
function search(h, text) {
  const input = q(h, 'input');
  input.value = text;
  input.dispatchEvent(new h.win.Event('input', { bubbles: true }));
}
async function domChecks(data, source = feature, probe = null) {
  const first = data.rows[0];
  const h = await domHarness(source, first.before);
  try {
    if (!probe || probe === 'query') {
      check(
        q(h, '.ic-count').textContent === '740 characters · 16 categories',
        'all catalog entries counted'
      );
      check(h.host.querySelectorAll('details').length === 16, 'all categories present');
      check(q(h, '.ic-chip') === null, 'closed categories lazy');
      search(h, 'DREAM—FLOATING');
      check(q(h, '.ic-count').textContent === '1 match', 'production normalization');
      check(q(h, '.ic-chip').dataset.preface === 'dream-floating', 'real query hit');
      if (probe) return;
      search(h, 'zz_no_match_zz');
      check(q(h, '.ic-count').textContent.includes('No character matches'), 'empty search');
      search(h, '');
      q(h, '[data-action="expand"]').click();
      check(
        h.host.querySelectorAll('details[open] .ic-chip').length === 740,
        'expand reaches 740 entries'
      );
      const actual = [...h.host.querySelectorAll('details .ic-chip')].map((e) => e.dataset.preface);
      assert.deepEqual(
        actual,
        data.categories.flatMap((c) => c.prefaces.map((e) => e.id))
      );
      check(true, 'canonical entry order');
      const openFirst = q(h, 'details');
      openFirst.open = false;
      await tick();
      check(!openFirst.querySelector('.ic-chip'), 'individual collapse unloads chips');
      openFirst.open = true;
      await tick();
      check(!!openFirst.querySelector('.ic-chip'), 'individual open loads chips');
      search(h, 'bitter');
      search(h, '');
      check(q(h, 'details').open, 'search preserves disclosure');
      q(h, '[data-action="collapse"]').click();
      check(!q(h, 'details[open]'), 'collapse all');
      const stableInput = q(h, 'input');
      stableInput.focus();
      search(h, 'bitter');
      check(
        q(h, 'input') === stableInput && h.win.document.activeElement === stableInput,
        'stable input and focus'
      );
      const messagesBefore = h.messages.length;
      await new Promise((r) => setTimeout(r, 450));
      check(h.messages.length === messagesBefore, 'no early count announcement');
      await new Promise((r) => setTimeout(r, 190));
      check(h.messages.at(-1) === q(h, '.ic-count').textContent, '600ms announcement');
    }
    if (!probe || probe === 'revision') {
      search(h, 'dream-floating');
      const button = q(h, '.ic-chip');
      button.focus();
      button.click();
      assert.deepEqual(h.adapter.calls.at(-1), {
        type: 'choose',
        prefaceId: first.choice,
        revision: 1,
      });
      check(true, 'action carries displayed revision');
      h.adapter.publish(first.picked);
      h.adapter.pending.shift().resolve(first.picked);
      await tick();
      check(
        q(h, '.ic-current').textContent.includes('dream-floating · chosen'),
        'canonical chosen label'
      );
      check(h.win.document.activeElement.dataset.preface === first.choice, 'chip focus restored');
      q(h, '[data-action="automatic"]').click();
      check(h.adapter.calls.at(-1).type === 'automatic', 'automatic delegates');
      h.adapter.publish(first.automatic);
      h.adapter.pending.shift().resolve(first.automatic);
      await tick();
      check(q(h, '[data-action="automatic"]').hidden, 'automatic button disappears');
      if (probe) return;
    }
    if (!probe || probe === 'dispose') {
      search(h, 'bitter');
      q(h, '.ic-chip').click();
      const pending = h.adapter.pending.shift();
      h.controller.abort();
      pending.resolve(first.before);
      await tick();
      check(h.host.childNodes.length === 0, 'abort removes owned CSS and content');
      check(h.adapter.subscribers.size === 0, 'abort unsubscribes');
      h.handle.unmount();
      h.handle.focus();
      if (probe) return;
    }
  } finally {
    h.handle.unmount();
    h.dom.window.close();
  }
  // Reordering and stale selection with a deliberately different instrument.
  const r = await domHarness(source, first.before, { refuse: true });
  try {
    search(r, first.choice);
    q(r, '.ic-chip').click();
    const old = r.adapter.pending.shift();
    check(
      r.messages.includes('Recently used characters are not saved on this device.'),
      'storage refusal announced'
    );
    check(
      q(r, '.ic-error:not([hidden])').textContent.includes('not saved'),
      'storage refusal visible'
    );
    r.adapter.publish(data.rows[1].before); // Revision resets on another selection.
    old.reject({ code: 'STALE', message: 'Old selection refused.' });
    await tick();
    check(q(r, 'input').value === '', 'selection clears search');
    check(
      !q(r, '.ic-current').textContent.includes('dream-floating'),
      'old result does not replace selection'
    );
    check(
      !r.messages.includes('Old selection refused.'),
      'old rejection does not pollute new selection'
    );
    search(r, 'bitter');
    q(r, '.ic-chip').click();
    r.adapter.pending
      .shift()
      .reject({ code: 'STALE', message: 'This preview moved; choose again.' });
    await tick();
    check(
      r.messages.at(-1) === 'This preview moved; choose again.',
      'safe STALE wording preserved'
    );
    check(
      q(r, '.ic-error:not([hidden])').textContent === 'This preview moved; choose again.',
      'safe failure visible'
    );
    q(r, '.ic-chip').click();
    const earlier = r.adapter.pending.shift();
    r.adapter.publish(data.rows[1].picked);
    q(r, '[data-action="automatic"]').click();
    const newer = r.adapter.pending.shift();
    r.adapter.publish(data.rows[1].automatic);
    newer.resolve(data.rows[1].automatic);
    earlier.resolve(data.rows[1].picked);
    await tick();
    check(
      q(r, '.ic-current').textContent.startsWith('jeong · automatic'),
      'late result never rewinds'
    );
    q(r, 'input').focus();
    r.adapter.publish({ status: 'loading', error: null, instrumentId: 'voice', revision: 4 });
    check(r.win.document.activeElement === q(r, '.ic-status'), 'loading retains focus on status');
    r.adapter.publish({ ...data.rows[1].automatic, revision: 5 });
    check(
      r.win.document.activeElement === q(r, 'input'),
      'loading recovery restores visible focus'
    );
    r.adapter.publish({
      status: 'error',
      error: { code: 'FETCH', message: 'Try again later.' },
      instrumentId: 'voice',
      revision: 6,
    });
    check(r.win.document.activeElement === q(r, '.ic-status'), 'error focus remains visible');
    r.adapter.publish({ ...data.rows[1].automatic, revision: 7 });
    check(r.win.document.activeElement === q(r, 'input'), 'error recovery restores visible focus');
    const outside = r.win.document.getElementById('outside');
    outside.focus();
    r.adapter.publish({ ...data.rows[2].before, revision: 8 });
    check(r.win.document.activeElement === outside, 'subscription never steals outside focus');
    r.adapter.publish({
      status: 'error',
      error: { code: 'FETCH', message: 'Catalog unavailable: try later.' },
      instrumentId: 'grand_piano',
      revision: 9,
    });
    check(
      q(r, '.ic-status').textContent === 'Catalog unavailable: try later.',
      'snapshot error wording preserved'
    );
    r.adapter.publish({
      status: 'loading',
      error: null,
      instrumentId: 'grand_piano',
      revision: 10,
    });
    check(
      q(r, '.ic-content').hidden && q(r, '.ic-status').textContent === 'Loading character…',
      'loading state'
    );
    r.adapter.publish({ ...data.noCharacter, revision: 11 });
    check(q(r, '.ic-current').textContent.startsWith('None · automatic'), 'real null label');
    check(q(r, '.ic-suggestion').hidden, 'null suggestion absent');
    // Two independently mounted instances; each owns its link and listeners.
    const secondHost = r.win.document.getElementById('b');
    const secondSignal = new r.win.AbortController();
    const second = r.mount(secondHost, Object.freeze({ ...r.ctx, signal: secondSignal.signal }));
    check(r.win.document.querySelectorAll('link').length === 2, 'one CSS link per instance');
    r.handle.unmount();
    check(
      secondHost.querySelector('link') && r.adapter.subscribers.size === 1,
      'first cleanup preserves other instance'
    );
    second.unmount();
    check(r.adapter.subscribers.size === 0, 'both subscriptions removed');
  } finally {
    r.handle.unmount();
    r.dom.window.close();
  }

  const recent = await domHarness(source, first.before, {
    prior: ['bitter', 'bitter', 'not-in-catalog', 'dream-floating'],
  });
  try {
    check(
      recent.host.querySelectorAll('.ic-recents .ic-chip').length === 2,
      'stored recents dedup and filter missing IDs'
    );
    search(recent, 'bitter');
    check(q(recent, '.ic-recents').hidden, 'search hides recents');
    q(recent, '.ic-chip').click();
    assert.deepEqual(recent.writes.at(-1), [
      'recent',
      ['bitter', 'not-in-catalog', 'dream-floating'],
    ]);
    check(true, 'scoped MRU write');
  } finally {
    recent.handle.unmount();
    recent.dom.window.close();
  }
  const focusAbort = await domHarness(source, first.before);
  search(focusAbort, first.choice);
  const focusButton = q(focusAbort, '.ic-chip');
  focusButton.focus();
  focusAbort.host.addEventListener('focusin', () => focusAbort.controller.abort(), { once: true });
  focusButton.click();
  check(focusAbort.controller.signal.aborted, 'restored focus can dispose mount');
  check(focusAbort.host.childNodes.length === 0, 'focus-triggered abort cleans DOM');
  check(focusAbort.adapter.calls.length === 0, 'focus-triggered abort prevents dispatch');
  focusAbort.dom.window.close();
  const aborted = await domHarness(source, first.before, { aborted: true });
  check(
    aborted.host.childNodes.length === 0 && aborted.adapter.subscribers.size === 0,
    'already-aborted mount inert'
  );
  aborted.dom.window.close();
  for (const kind of ['abortOnRead', 'abortOnWrite', 'abortOnAnnounce']) {
    const reentrant = await domHarness(source, first.before, {
      [kind]: true,
      refuse: kind === 'abortOnAnnounce',
    });
    if (kind !== 'abortOnRead') {
      search(reentrant, first.choice);
      q(reentrant, '.ic-chip').click();
    }
    check(reentrant.host.childNodes.length === 0, kind + ' removes DOM');
    check(reentrant.adapter.subscribers.size === 0, kind + ' removes subscription');
    check(reentrant.adapter.calls.length === 0, kind + ' prevents post-abort dispatch');
    reentrant.dom.window.close();
  }
}

async function contractChecks(data, source = feature, probe = null) {
  const all = data.categories.flatMap((c) => c.prefaces);
  const noted = all.find(
    (e) =>
      e.note &&
      !canonicalNormalize(e.id).includes(canonicalNormalize(e.note)) &&
      e.glyph.category &&
      e.glyph.entry
  );
  check(!!noted, 'real note-only search and glyph-pair fixture exists');
  const h = await domHarness(source, data.rows[0].before, { prior: [noted.id] });
  try {
    const recent = q(h, '.ic-recents .ic-chip');
    if (!probe || probe === 'label') {
      check(recent.textContent === noted.id, 'preface displays ID without removed name field');
    }
    if (!probe || probe === 'note') {
      search(h, noted.note);
      const expected = all
        .filter(
          (e) =>
            canonicalNormalize(e.id).includes(canonicalNormalize(noted.note)) ||
            canonicalNormalize(e.note || '').includes(canonicalNormalize(noted.note))
        )
        .map((e) => e.id);
      assert.deepEqual(
        [...h.host.querySelectorAll('.ic-categories .ic-chip')].map((e) => e.dataset.preface),
        expected,
        'real note-only search'
      );
      const hit = [...h.host.querySelectorAll('.ic-categories .ic-chip')].find(
        (e) => e.dataset.preface === noted.id
      );
      check(hit?.title === noted.note, 'real note exposed as tooltip');
      check(h.adapter.normalizations.includes(noted.note), 'host normalizes real note');
    }
    if (!probe || probe === 'glyph') {
      search(h, '');
      const pair = [...q(h, '.ic-recents .ic-chip').querySelectorAll('img')];
      assert.deepEqual(
        pair.map((img) => img.getAttribute('src')),
        [noted.glyph.category, noted.glyph.entry],
        'real pair order category then entry'
      );
      check(
        pair.every((img) => img.getAttribute('alt') === ''),
        'glyph pair is decorative'
      );
      h.adapter.publish({ ...data.rows[0].before, revision: 2, suggestion: noted.id });
      assert.deepEqual(
        [...q(h, '.ic-suggestion .ic-chip').querySelectorAll('img')].map((img) =>
          img.getAttribute('src')
        ),
        [noted.glyph.category, noted.glyph.entry],
        'suggestion glyph pair'
      );
      search(h, noted.note);
      const grouped = [...h.host.querySelectorAll('.ic-categories .ic-chip')].find(
        (e) => e.dataset.preface === noted.id
      );
      assert.deepEqual(
        [...grouped.querySelectorAll('img')].map((img) => img.getAttribute('src')),
        [noted.glyph.entry],
        'grouped entry-only glyph'
      );
      search(h, '');
      q(h, '[data-action="expand"]').click();
      const expanded = [...h.host.querySelectorAll('details .ic-chip')].find(
        (e) => e.dataset.preface === noted.id
      );
      assert.deepEqual(
        [...expanded.querySelectorAll('img')].map((img) => img.getAttribute('src')),
        [noted.glyph.entry],
        'expanded category entry-only glyph'
      );
    }
    if (!probe) {
      // Contract permits unavailable art/notes. Same real entry, boundary projection only.
      let revision = 3;
      for (const glyph of [
        { category: null, entry: null },
        { category: noted.glyph.category, entry: null },
        { category: null, entry: noted.glyph.entry },
      ]) {
        const missing = data.categories.map((c) => ({
          ...c,
          prefaces: c.prefaces.map((e) => (e.id === noted.id ? { ...e, note: null, glyph } : e)),
        }));
        search(h, '');
        h.adapter.publish({
          ...data.rows[0].before,
          revision: revision++,
          categories: missing,
          suggestion: noted.id,
        });
        const chip = q(h, '.ic-suggestion .ic-chip');
        check(chip.textContent === noted.id, 'nullable glyph projection keeps ID');
        assert.deepEqual(
          [...chip.querySelectorAll('img')].map((img) => img.getAttribute('src')),
          [glyph.category, glyph.entry].filter(Boolean),
          'only available pair URLs render'
        );
        check(!chip.hasAttribute('title'), 'null note has no tooltip');
        search(h, noted.id);
        const grouped = [...h.host.querySelectorAll('.ic-categories .ic-chip')].find(
          (e) => e.dataset.preface === noted.id
        );
        assert.deepEqual(
          [...grouped.querySelectorAll('img')].map((img) => img.getAttribute('src')),
          [glyph.entry].filter(Boolean),
          'nullable grouped projection excludes category'
        );
      }
      // Restore canonical projection for subsequent normalization checks.
      h.adapter.publish({ ...data.rows[0].before, revision: 6 });
    }
    if (!probe || probe === 'normalize') {
      search(h, '  DREAM—FLOATING  ');
      check(
        h.adapter.normalizations.includes('  DREAM—FLOATING  '),
        'query sent unchanged to host normalizer'
      );
      check(
        !!h.host.querySelector('[data-preface="dream-floating"]'),
        'host canonical normalization'
      );
    }
  } finally {
    h.handle.unmount();
    h.dom.window.close();
  }
  return {
    id: noted.id,
    note: noted.note,
    categoryGlyph: noted.glyph.category?.slice(0, 40),
    entryGlyph: noted.glyph.entry?.slice(0, 40),
  };
}

async function mutations(data) {
  const defects = [
    ['query normalization', 'return-placeholder', 'query'],
    ['displayed revision', 'revision: revision + 1', 'revision'],
    ['unsubscribe', 'unsubscribe omitted', 'dispose'],
  ];
  for (const [name, _marker, probe] of defects) {
    let mutated = feature;
    if (probe === 'query') mutated = feature.replaceAll('api.normalize(', 'String(');
    if (probe === 'revision')
      mutated = feature.replace(
        'api.choose({ prefaceId, revision })',
        'api.choose({ prefaceId, revision: revision + 1 })'
      );
    if (probe === 'dispose')
      mutated = feature.replace('    unsubscribe();', '    // planted missing unsubscribe');
    assert.notEqual(mutated, feature, 'mutation applied: ' + name);
    let caught = false;
    try {
      await domChecks(data, mutated, probe);
    } catch (e) {
      if (e.code !== 'ERR_ASSERTION') throw e;
      caught = true;
    }
    check(caught, 'mutation detected: ' + name);
  }
}

async function correctionMutations(data) {
  const variants = [
    [
      'missing note search',
      feature.replace(" || api.normalize(e.note || '').includes(q)", ''),
      'note',
    ],
    ['missing tooltip', feature.replace('if (entry.note) b.title = entry.note;', ''), 'note'],
    [
      'reversed glyph pair',
      feature.replace(
        'if (!axis2Only && entry.glyph.category) b.append(glyph(entry.glyph.category));\n    if (entry.glyph.entry) b.append(glyph(entry.glyph.entry));',
        'if (entry.glyph.entry) b.append(glyph(entry.glyph.entry));\n    if (!axis2Only && entry.glyph.category) b.append(glyph(entry.glyph.category));'
      ),
      'glyph',
    ],
    [
      'category glyph in grouped chips',
      feature.replace('if (!axis2Only && entry.glyph.category)', 'if (entry.glyph.category)'),
      'glyph',
    ],
  ];
  for (const [name, mutated, probe] of variants) {
    assert.notEqual(mutated, feature, 'correction mutation applied: ' + name);
    await assert.rejects(() => contractChecks(data, mutated, probe), { code: 'ERR_ASSERTION' });
    check(true, 'correction mutation detected: ' + name);
    console.log('Mutation detected: ' + name);
  }
}

async function browserChecks(data) {
  const server = http.createServer((req, res) => {
    if (req.url === '/character.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(feature);
    } else if (req.url === '/character.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(fs.readFileSync(cssPath));
    } else if (req.url === '/normalize.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end('export default ' + data.normalizeSource);
    } else if (req.url === '/fixtures.json') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(
        '<!doctype html><meta name="viewport" content="width=device-width"><main id="host"></main><button id="outside">Outside</button>'
      );
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    // Explicitly keep the browser sandbox. Never retry with --no-sandbox.
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM || '/usr/bin/chromium',
      chromiumSandbox: true,
    });
    for (const width of [1280, 390, 320]) {
      const page = await browser.newPage({
        viewport: { width, height: 850 },
        reducedMotion: 'reduce',
      });
      await page.goto('http://127.0.0.1:' + server.address().port);
      await page.evaluate(async () => {
        const { mount } = await import('/character.js');
        const { default: normalize } = await import('/normalize.js');
        const data = await (await fetch('/fixtures.json')).json();
        let snapshot = data.rows[0].before;
        const listeners = new Set();
        window.characterMessages = [];
        const api = {
          normalize,
          snapshot: () => Object.freeze(snapshot),
          subscribe: (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
          },
          async choose({ prefaceId, revision }) {
            if (revision !== snapshot.revision)
              throw { code: 'STALE', message: 'Preview changed.' };
            if (prefaceId !== data.rows[0].choice) throw new Error('Unexpected test choice');
            snapshot = data.rows[0].picked;
            listeners.forEach((fn) => fn());
            return snapshot;
          },
          async automatic({ revision }) {
            if (revision !== snapshot.revision)
              throw { code: 'STALE', message: 'Preview changed.' };
            snapshot = data.rows[0].automatic;
            listeners.forEach((fn) => fn());
            return snapshot;
          },
        };
        window.characterController = new AbortController();
        window.characterHandle = mount(
          document.getElementById('host'),
          Object.freeze({
            character: api,
            signal: window.characterController.signal,
            announce: (s) => window.characterMessages.push(s),
            storage: { read: () => ({ ok: true, value: null }), write: () => ({ ok: true }) },
          })
        );
      });
      await page.getByRole('button', { name: 'Expand all', exact: true }).click();
      check(
        (await page.locator('details .ic-chip').count()) === 740,
        'browser full reachability ' + width
      );
      await page.getByRole('searchbox', { name: 'Search characters' }).fill('DREAM—FLOATING');
      await page.getByRole('button', { name: 'dream-floating', exact: true }).click();
      await page.getByRole('button', { name: 'Back to automatic' }).click();
      check(
        (await page.locator('.ic-current').textContent()) ===
          'dream-floating · automatic, from the parts',
        'browser real-derived lifecycle'
      );
      const noOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      );
      check(noOverflow, 'browser no horizontal overflow ' + width);
      check(
        (await page.locator('.ic-content').evaluate((el) => getComputedStyle(el).display)) ===
          'grid',
        'module stylesheet loaded'
      );
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        '200% text no overflow'
      );
      await page.evaluate(() => window.characterController.abort());
      check((await page.locator('#host > *').count()) === 0, 'browser cleanup');
      await page.close();
    }
  } catch (e) {
    if (!browser) {
      console.error('BROWSER UNEXECUTED: ' + e.stack);
      process.exitCode = 2;
    } else throw e;
  } finally {
    if (browser) await browser.close();
    await new Promise((r) => server.close(r));
  }
}

(async () => {
  const data = fixtures();
  if (process.env.CHARACTER_BEFORE_SOURCE) {
    const old = fs.readFileSync(process.env.CHARACTER_BEFORE_SOURCE, 'utf8');
    for (const probe of ['label', 'note', 'glyph', 'normalize']) {
      await assert.rejects(() => contractChecks(data, old, probe), { code: 'ERR_ASSERTION' });
      console.log('FAILS BEFORE as expected: ' + probe);
    }
    return;
  }
  const correctionFixture = await contractChecks(data);
  await domChecks(data);
  await mutations(data);
  await correctionMutations(data);
  console.log(
    JSON.stringify(
      {
        kind: 'source + DOM fixture checks, not integration',
        head: HEAD,
        checks,
        correctionFixture,
        realFixtures: data.rows.map((r) => ({
          instrument: r.before.instrumentId,
          before: r.before.current,
          pick: r.picked.current,
          automatic: r.automatic.current,
        })),
      },
      null,
      2
    )
  );
  if (!process.argv.includes('--dom')) await browserChecks(data);
  console.log('Checks including executed browser assertions: ' + checks);
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});

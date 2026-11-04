// Standalone fixture scenario; no manifest completion or host integration claim.
// Run: node prototype/scenarios/library-methods/reference.cjs
// Optional sensitivity probe: METHOD_REFERENCE_MUTATION=definition-search
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'library/data/methods.json'), 'utf8'));
let code = fs.readFileSync(path.join(root, 'prototype/features/library-methods/reference.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'prototype/features/library-methods/reference.css'), 'utf8');
if (process.env.METHOD_REFERENCE_MUTATION === 'definition-search') {
  const from = '${m.aliases?.join(\' \')}';
  assert(code.includes(from), 'mutation target exists');
  code = code.replace(from, '${m.definition}');
}
const expected = (q) => registry.methods.filter((m) =>
  `${m.name} ${m.aliases?.join(' ')} ${m.required_capabilities?.join(' ')}`.toLowerCase().includes(q.toLowerCase())
).slice(0, 300).map((m) => m.id);
async function run() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Every response is fulfilled locally; no live site or service is requested.
    await page.route('**/*', (route) => {
      const name = new URL(route.request().url()).pathname;
      requests.push(name);
      if (name === '/reference.js') return route.fulfill({ contentType: 'text/javascript', body: code });
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><style>body{margin:16px;background:#ffffff}' + css + '</style><button id="before">Before</button><main id="host"></main><button id="after">After</button>' });
    });
    await page.goto('http://localhost/method-reference');
    await page.evaluate(async (data) => {
      const freeze = (v) => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
      window.source = freeze(data);
      window.before = JSON.stringify(data);
      window.module = await import('/reference.js');
      window.notices = [];
      window.storageCalls = 0;
      window.controller = new AbortController();
      window.makeContext = (registry = window.source, signal = window.controller.signal) => Object.freeze({
        registry, signal, announce: (s) => window.notices.push(s),
        storage: Object.freeze({ read() { window.storageCalls++; return { ok: false, reason: 'unavailable' }; }, write() { window.storageCalls++; return { ok: false, reason: 'full' }; } }),
      });
      window.instance = window.module.mount(document.querySelector('#host'), window.makeContext());
      window.instance.focus();
    }, registry);
    assert.equal(await page.locator('.la-method-search').count(), 0, 'closed outer disclosure is lazy');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Method reference');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.la-method');
    const ids = () => page.locator('[data-method]').evaluateAll((els) => els.map((e) => e.dataset.method));
    assert.deepEqual(await ids(), expected(''), 'initial exact source order/count');
    const search = page.getByRole('searchbox', { name: 'Search method reference' });
    const queries = ['PERFECT RHYME', 'qafiya (segmental core)', 'prominence', 'ONSET MUST-DIFFER', '  ', 'undefined', '<script>', 'zzzz-unmatched', ''];
    for (const query of queries) {
      await search.fill(query);
      await page.waitForTimeout(180);
      assert.deepEqual(await ids(), expected(query), 'native filter: ' + JSON.stringify(query));
    }
    const first = page.locator('[data-method]').first();
    await first.locator(':scope > summary').click();
    assert((await first.textContent()).includes(registry.methods[0].definition), 'definition shown literally');
    assert((await first.textContent()).includes('Pair-local'), 'scope shown');
    assert((await first.textContent()).includes('Also called ' + registry.methods[0].aliases.join(', ')));
    assert((await first.textContent()).includes(registry.methods[0].remedies.prominence));
    await first.locator('[data-mfig] > summary').click();
    await first.locator('[data-mprov] > summary').click();
    await page.waitForTimeout(60);
    assert((await first.locator('[data-mfig]').textContent()).includes('Channels'));
    assert((await first.locator('[data-mprov]').textContent()).includes('Traditions'));
    const tradition = first.locator('[data-mprov] details').first();
    await tradition.locator(':scope > summary').click();
    await page.waitForTimeout(40);
    assert((await tradition.textContent()).includes(registry.methods[0].provenance.traditions[0].why), 'deferred provenance body is rendered');
    await tradition.locator(':scope > summary').click();
    await tradition.locator(':scope > summary').click();
    await page.waitForTimeout(40);
    assert.equal(await tradition.locator(':scope > dl').count(), 1, 'reopening does not duplicate deferred body');
    assert.equal(await page.locator('[data-act="analyze-method"]').count(), 0, 'no analysis execution');
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow ' + width);
    }
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '200 percent text at 320px stays within viewport');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
      document.documentElement.style.setProperty('--fg', '#ececf1');
      document.documentElement.style.setProperty('--bg', '#15161a');
    });
    assert.equal(await page.locator('.lm-reference').evaluate((el) => getComputedStyle(el).color), 'rgb(236, 236, 241)', 'shell dark foreground token');
    assert.equal(await search.evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(21, 22, 26)', 'shell dark input token');
    await page.evaluate(() => { document.querySelector('.lm-disclosure').open = false; });
    await page.waitForTimeout(30);
    await page.evaluate(() => { document.querySelector('.lm-disclosure').open = true; });
    await page.waitForTimeout(30);
    assert(await first.evaluate((el) => el.open), 'outer reopening preserves child disclosure');
    assert.equal(await page.evaluate(() => JSON.stringify(window.source) === window.before), true, 'source untouched');
    assert.equal(await page.evaluate(() => window.storageCalls), 0, 'reference has no persisted state');
    await search.fill('queued');
    await page.evaluate(() => { window.controller.abort(); window.noticeCount = window.notices.length; });
    await page.waitForTimeout(180);
    assert.equal(await page.locator('.lm-reference').count(), 0, 'abort removes component');
    assert.equal(await page.evaluate(() => window.notices.length === window.noticeCount), true, 'abort cancels delayed announcement');
    await page.evaluate(() => { window.instance.unmount(); window.instance.focus(); window.module.mount(document.querySelector('#host'), window.makeContext()); });
    assert.equal(await page.locator('.lm-reference').count(), 0, 'pre-aborted mount is inert');
    // Production-shaped edges, including the native display cap and escaped text.
    await page.evaluate(() => {
      window.controller = new AbortController();
      const rows = Array.from({ length: 305 }, (_, i) => ({ id: 'fixture:' + i, name: '<img src=x onerror=alert(1)> ' + i, namespace: 'fixture', definition: '', aliases: [], required_capabilities: [], normative: 'ordinary', scope: 'line' }));
      window.instance = window.module.mount(document.querySelector('#host'), window.makeContext({ methods: rows }));
      window.instance.focus();
    });
    await page.keyboard.press('Enter');
    await page.waitForSelector('.la-method');
    assert.equal(await page.locator('[data-method]').count(), 300, 'native cap');
    assert.equal(await page.locator('.lm-reference img').count(), 0, 'text cannot inject markup');
    assert((await page.locator('.lm-count').textContent()).includes('305 matching'));
    assert((await page.locator('.la-method').first().textContent()).includes('Definition supplied by the installed engine.'));
    assert.equal(await page.locator('.la-badge').count(), 0, 'ordinary badge omitted');
    await page.evaluate(() => {
      window.instance.unmount();
      window.instance = window.module.mount(document.querySelector('#host'), window.makeContext({ methods: [{
        id: 'large', name: 'Large values', namespace: 'fixture', pair_local: false,
        figure: { nodes: 2 }, channels: Array.from({length: 105}, (_, i) => 'channel-' + i)
      }] }));
      window.instance.focus();
    });
    await page.keyboard.press('Enter');
    await page.waitForSelector('.la-method');
    await page.locator('.la-method > summary').click();
    assert((await page.locator('.la-method').textContent()).includes('Whole figure'));
    await page.locator('[data-mfig] > summary').click();
    await page.waitForTimeout(40);
    const more = page.getByRole('button', { name: 'Show next values · 100 / 105' });
    await more.click();
    assert((await page.locator('[data-mfig]').textContent()).includes('channel-104'), 'value pagination reaches the last entry');
    await page.evaluate(() => {
      window.instance.unmount();
      window.instance = window.module.mount(document.querySelector('#host'), window.makeContext({ methods: [] }));
      window.instance.focus();
    });
    await page.keyboard.press('Enter');
    await page.waitForSelector('.lm-count');
    assert.equal(await page.locator('[data-method]').count(), 0);
    assert((await page.locator('.la-method-list').textContent()).includes('No method matches'));
    assert.deepEqual(errors, [], 'no browser errors');
    assert.deepEqual(requests, ['/method-reference', '/reference.js'], 'no unexpected component network requests');
    console.log('PASS: real-registry filtering/order, native details, keyboard, viewports, immutable input, lifecycle, cap, escaping and empty state');
  } finally { await browser.close(); }
}
run().catch((e) => { console.error(e); process.exitCode = 1; });

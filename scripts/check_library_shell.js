#!/usr/bin/env node
// check_library_shell.js — the native Library tab's shell plumbing, in a real
// browser (docs/library-native-design.md, "Code loading", "Hash grammar").
//
//   default build    byte-identical to the committed codex.html; carries no
//                    Library code; #library falls back to Genre and nothing
//                    under library/ is requested
//   flagged lazy     (CODEX_LIBRARY=1) the Library nav entry; #library loads the
//                    core chunk once, with its sha384 integrity; sections push
//                    sub-routes, Back is the page's own pop, a nav click resumes
//                    where the reader was; a chunk whose bytes do not match its
//                    integrity is refused and the tab says the site was updated
//                    head preloads: on #library the core chunk is asked for from
//                    <head> and the loader reuses it (one request), and
//                    catalog.json is requested; off-route, hovering the nav
//                    entry fetches the core chunk before the click
//   flagged embedded the same chunk inlined: no library/ request at all
//
// Usage: node scripts/check_library_shell.js

/* global document, location, UI -- inside page.evaluate callbacks */
'use strict';
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
};

function build(dir, env, extra = []) {
  fs.mkdirSync(dir, { recursive: true });
  execFileSync(
    process.execPath,
    [path.join(ROOT, 'scripts/build_html.js'), `--out=${path.join(dir, 'codex.html')}`, ...extra],
    { env: { ...process.env, ...env }, stdio: ['ignore', 'ignore', 'pipe'] }
  );
}

// The build's own directory first (codex.html, library/code), then the repo
// (api/, assets/).
function serve(dir) {
  return http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    for (const base of [dir, ROOT]) {
      const f = path.join(base, p);
      if (f.startsWith(base) && fs.existsSync(f) && fs.statSync(f).isFile()) {
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(f)] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        return fs.createReadStream(f).pipe(res);
      }
    }
    res.writeHead(404);
    res.end('not found');
  });
}

function chromiumPath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !fs.existsSync(base)) return undefined;
  for (const d of fs.readdirSync(base)) {
    if (!/^chromium-\d+$/.test(d)) continue;
    const exe = path.join(base, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

(async () => {
  const { chromium } = require('playwright');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'library-shell-'));
  const dirs = {
    plain: path.join(temp, 'default'),
    lazy: path.join(temp, 'lazy'),
    embedded: path.join(temp, 'embedded'),
  };
  build(dirs.plain, { CODEX_LIBRARY: '' });
  build(dirs.lazy, { CODEX_LIBRARY: '1' });
  build(dirs.embedded, { CODEX_LIBRARY: '1' }, ['--embedded']);
  const plainHtml = fs.readFileSync(path.join(dirs.plain, 'codex.html'));
  assert.ok(
    plainHtml.equals(fs.readFileSync(path.join(ROOT, 'codex.html'))),
    'a default build must be byte-identical to the committed codex.html'
  );
  for (const marker of ['CMLibraryDefine', 'library/code/', 'surface-library', 'LIBRARY_CHUNKS'])
    assert.ok(!plainHtml.includes(marker), `the default build carries Library code: ${marker}`);
  assert.ok(!fs.existsSync(path.join(dirs.plain, 'library')), 'the default build emits no chunks');
  const chunks = fs.readdirSync(path.join(dirs.lazy, 'library/code'));
  assert.equal(chunks.length, 1);
  assert.match(chunks[0], /^core\.[0-9a-f]{10}\.js$/);
  assert.ok(!fs.existsSync(path.join(dirs.embedded, 'library')), 'the embedded build inlines');

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumPath(),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const open = async (dir, hash, intercept) => {
    const server = serve(dir);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route(/mcp\.codexmusica\.com/, (r) =>
      r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
    );
    if (intercept) await ctx.route(/library\/code\//, intercept);
    const page = await ctx.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => requests.push(new URL(r.url()).pathname));
    await page.goto(`http://127.0.0.1:${server.address().port}/codex.html${hash}`);
    await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready, null, {
      timeout: 60000,
    });
    return {
      page,
      errors,
      requests,
      close: async () => {
        await ctx.close();
        server.close();
      },
    };
  };
  const shown = (page, text) =>
    page.waitForFunction(
      (t) =>
        document.getElementById('library-main')?.dataset.libraryChunk === 'core' &&
        document.getElementById('library-main').textContent.includes(t),
      text,
      { timeout: 30000 }
    );

  // The default build: no Library route; #library falls back to Genre.
  {
    const s = await open(dirs.plain, '#library');
    assert.equal(await s.page.evaluate(() => UI.view), 'genre');
    assert.equal(await s.page.evaluate(() => location.hash), '#genre');
    assert.equal(await s.page.$('button.cm-tab[data-view="library"]'), null);
    assert.deepEqual(
      s.requests.filter((p) => p.includes('/library/')),
      []
    );
    assert.deepEqual(s.errors, []);
    await s.close();
  }

  // The flagged lazy build: the route, the chunk with its integrity, sub-routes.
  {
    const s = await open(dirs.lazy, '#library');
    const { page } = s;
    await shown(page, 'Explore');
    assert.ok(await page.$('button.cm-tab[data-view="library"]'), 'the Library nav entry');
    const core = s.requests.filter((p) => p.startsWith('/library/code/'));
    assert.deepEqual(core, ['/library/code/' + chunks[0]], 'core is fetched once');
    assert.ok(
      await page.$(`head link[rel="preload"][as="script"][href="library/code/${chunks[0]}"]`),
      'the core chunk is preloaded from <head>'
    );
    assert.ok(s.requests.includes('/library/data/catalog.json'), 'catalog.json is preloaded');
    assert.ok(
      !s.requests.includes('/api/browse_boot.json') ||
        s.requests.indexOf('/library/data/catalog.json') <
          s.requests.indexOf('/api/browse_boot.json'),
      'the boot index is not asked for ahead of the Library on #library'
    );
    assert.match(
      await page.evaluate(() => document.querySelector('script[src*="library/code/"]').integrity),
      /^sha384-/
    );
    await page.click('[data-ui="lib-section"][data-id="/works"]');
    await shown(page, 'Works');
    assert.equal(await page.evaluate(() => location.hash), '#library/works');
    await page.goBack();
    await shown(page, 'Explore');
    assert.equal(await page.evaluate(() => location.hash), '#library');
    await page.goForward();
    await shown(page, 'Works');
    await page.click('button.cm-tab[data-view="genre"]');
    await page.waitForFunction(() => UI.view === 'genre');
    await page.click('button.cm-tab[data-view="library"]');
    await shown(page, 'Works');
    assert.equal(await page.evaluate(() => location.hash), '#library/works', 'resumes');
    assert.equal(
      s.requests.filter((p) => p.startsWith('/library/code/')).length,
      1,
      'a loaded chunk is never fetched again'
    );
    assert.deepEqual(s.errors, []);
    await s.close();
  }

  // Off-route: no Library preload; hovering the nav entry fetches the core
  // chunk before any click.
  {
    const s = await open(dirs.lazy, '#genre');
    const { page } = s;
    assert.deepEqual(
      s.requests.filter((p) => p.includes('/library/')),
      [],
      'nothing under library/ is asked for off-route'
    );
    await page.hover('button.cm-tab[data-view="library"]');
    await page.waitForFunction(() => document.querySelector('script[src*="library/code/"]'), null, {
      timeout: 30000,
    });
    await page.waitForFunction(() => UI.view === 'genre');
    await page.click('button.cm-tab[data-view="library"]');
    await shown(page, 'Explore');
    assert.equal(
      s.requests.filter((p) => p.startsWith('/library/code/')).length,
      1,
      'the hover fetch is the only one'
    );
    assert.deepEqual(s.errors, []);
    await s.close();
  }

  // A chunk whose bytes do not match its integrity is refused.
  {
    const s = await open(dirs.lazy, '#library/works', async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace('Works', 'Werks');
      await route.fulfill({ response, body });
    });
    await s.page.waitForFunction(
      () => document.getElementById('library-main')?.textContent.includes('The site was updated'),
      null,
      { timeout: 30000 }
    );
    assert.ok(await s.page.$('#library-main [data-ui="lib-reload"]'), 'Reload is offered');
    assert.equal(
      await s.page.evaluate(() => document.getElementById('library-main').dataset.libraryChunk),
      undefined
    );
    await s.close();
  }

  // The flagged embedded build: the same chunk inlined, nothing fetched.
  {
    const s = await open(dirs.embedded, '#library/rights');
    await shown(s.page, 'Sources & rights');
    assert.deepEqual(
      s.requests.filter((p) => p.includes('/library/')),
      []
    );
    assert.deepEqual(s.errors, []);
    await s.close();
  }

  await browser.close();
  fs.rmSync(temp, { recursive: true, force: true });
  console.log(
    'LIBRARY SHELL: PASS — default build byte-identical with no Library code; flagged lazy: route, core chunk once with sha384 integrity, sub-routes push, Back/Forward pop, nav resumes, head preloads reused, hover warms the chunk, a tampered chunk refused with Reload; flagged embedded: inlined, no fetch'
  );
})().catch((error) => {
  console.error('LIBRARY SHELL: FAIL —', error.stack || error);
  process.exit(1);
});

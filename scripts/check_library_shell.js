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
//                    catalog.json is requested; off-route, a pointer entering
//                    the nav entry prefetches core and catalog.json (once,
//                    nothing executed) and focus prefetches nothing
//                    deferred boot: on #library the Library draws before the
//                    boot index; the workspace follows at idle; nothing starts
//                    the engine or asks for the prose while it is shown; a
//                    workspace control clicked early is held, busy, and acts
//                    once it is in; a saved session survives and is restored
//   flagged embedded the same chunks inlined: no library/code/ request at all
//
// Usage: node scripts/check_library_shell.js

/* global _workspaceReady, app, CMLibraryImport, document, localStorage, location, UI, uiOpenInLyrics -- inside page.evaluate callbacks */
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

// A saved session with one card, in the shape uiRestoreSession reads.
const SESSION = {
  version: 1,
  name: 'T',
  cards: [{ id: 'c1', instrumentId: 'voice', traditionId: 'dub', parts: {} }],
};

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
  // The Library is on by default; CODEX_LIBRARY=0 is the base without it.
  build(dirs.plain, { CODEX_LIBRARY: '0' });
  build(dirs.lazy, { CODEX_LIBRARY: '' });
  build(dirs.embedded, { CODEX_LIBRARY: '' }, ['--embedded']);
  const plainHtml = fs.readFileSync(path.join(dirs.plain, 'codex.html'));
  assert.ok(
    fs
      .readFileSync(path.join(dirs.lazy, 'codex.html'))
      .equals(fs.readFileSync(path.join(ROOT, 'codex.html'))),
    'a default build must be byte-identical to the committed codex.html'
  );
  for (const marker of ['CMLibraryDefine', 'library/code/', 'surface-library', 'LIBRARY_CHUNKS'])
    assert.ok(
      !plainHtml.includes(marker),
      `the build without the Library carries Library code: ${marker}`
    );
  assert.ok(
    !fs.existsSync(path.join(dirs.plain, 'library')),
    'the build without the Library emits no chunks'
  );
  const chunks = fs.readdirSync(path.join(dirs.lazy, 'library/code'));
  assert.ok(
    chunks.every((c) => /^[a-z][a-z0-9_-]*\.[0-9a-f]{10}\.js$/.test(c)),
    chunks.join(' ')
  );
  const core = chunks.find((c) => /^core\./.test(c));
  assert.ok(core, 'the core chunk is emitted');
  const chunkOf = (p) => p.replace(/^\/library\/code\//, '').split('.')[0];
  assert.ok(!fs.existsSync(path.join(dirs.embedded, 'library')), 'the embedded build inlines');
  // The Library's byte budgets on the flagged lazy page, and what it adds to
  // every route over the default build (scripts/check_payload_budget.js).
  execFileSync(
    process.execPath,
    [
      path.join(ROOT, 'scripts', 'check_payload_budget.js'),
      `--html=${path.join(dirs.lazy, 'codex.html')}`,
      `--api=${path.join(ROOT, 'api')}`,
      `--base=${path.join(dirs.plain, 'codex.html')}`,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] }
  );

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumPath(),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const open = async (dir, hash, intercept, { session, holdBoot } = {}) => {
    const server = serve(dir);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route(/mcp\.codexmusica\.com/, (r) =>
      r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
    );
    if (intercept) await ctx.route(/library\/code\//, intercept);
    if (session)
      await ctx.addInitScript(
        (text) => localStorage.setItem('codex-workbench-v1', text),
        JSON.stringify(session)
      );
    if (holdBoot)
      await ctx.route(/api\/browse_boot\.json/, async (r) => r.continue(await holdBoot));
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
  // A section is shown when the chunk that owns it has drawn its own content
  // into #library-main (core sets the chunk name before the chunk loads, so
  // the name alone is not enough).
  const SECTIONS = {
    Explore: ['core', '.lib-shelf'],
    Works: ['works', '.lw-table tbody tr'],
    'Sources & rights': ['rights', '.lr-view'],
  };
  const shown = (page, section) =>
    page.waitForFunction(
      ([chunk, selector]) => {
        const main = document.getElementById('library-main');
        return main?.dataset.libraryChunk === chunk && !!main.querySelector(selector);
      },
      SECTIONS[section],
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
    // Explore is core's own: core alone, fetched once.
    assert.deepEqual(
      s.requests.filter((p) => p.startsWith('/library/code/')),
      ['/library/code/' + core],
      'core is fetched once'
    );
    assert.ok(
      await page.$(`head link[rel="preload"][as="script"][href="library/code/${core}"]`),
      'the core chunk is preloaded from <head>'
    );
    assert.ok(s.requests.includes('/library/data/catalog.json'), 'catalog.json is preloaded');
    assert.ok(
      !s.requests.includes('/api/browse_boot.json') ||
        s.requests.indexOf('/library/data/catalog.json') <
          s.requests.indexOf('/api/browse_boot.json'),
      'the boot index is not asked for ahead of the Library on #library'
    );
    const integrity = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('script[src*="library/code/"]')].map((x) => x.integrity)
      );
    assert.ok(
      (await integrity()).every((i) => /^sha384-/.test(i)),
      'every chunk has sha384 integrity'
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
    const loaded = s.requests.filter((p) => p.startsWith('/library/code/'));
    assert.deepEqual(
      loaded.map(chunkOf).sort(),
      ['core', 'works'],
      'Explore and Works load core and works, each once: ' + loaded.join(' ')
    );
    const scripts = await integrity();
    assert.equal(scripts.length, 2, 'one script element per chunk');
    assert.ok(
      scripts.every((i) => /^sha384-/.test(i)),
      'every chunk carries sha384 integrity'
    );
    assert.deepEqual(s.errors, []);
    await s.close();
  }

  // Off-route: no Library preload; a pointer entering the nav entry prefetches
  // the core chunk and catalog.json (link rel=prefetch, nothing executed), and
  // keyboard focus prefetches nothing.
  {
    const s = await open(dirs.lazy, '#genre');
    const { page } = s;
    const libraryRequests = () => s.requests.filter((p) => p.includes('/library/'));
    assert.deepEqual(libraryRequests(), [], 'nothing under library/ is asked for off-route');
    await page.focus('button.cm-tab[data-view="library"]');
    await page.waitForTimeout(300);
    assert.deepEqual(libraryRequests(), [], 'focus prefetches nothing');
    await page.hover('button.cm-tab[data-view="library"]');
    await page.waitForFunction(
      (core) =>
        ['library/code/' + core, 'library/data/catalog.json'].every((href) =>
          document.head.querySelector(`link[rel="prefetch"][href="${href}"]`)
        ),
      core,
      { timeout: 30000 }
    );
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('script[src*="library/code/"]').length),
      0,
      'a hover runs no chunk'
    );
    await page.waitForFunction(
      (core) =>
        performance
          .getEntriesByType('resource')
          .some((e) => e.name.endsWith('/library/code/' + core)),
      core,
      { timeout: 30000 }
    );
    await page.mouse.move(0, 0);
    await page.hover('button.cm-tab[data-view="library"]');
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(() => document.head.querySelectorAll('link[rel="prefetch"]').length),
      2,
      'the prefetch is added once'
    );
    await page.click('button.cm-tab[data-view="library"]');
    await shown(page, 'Explore');
    assert.deepEqual(s.errors, []);
    await s.close();
  }

  // The deferred boot. On #library the page draws without the boot index or
  // the engine: the Library first, then the workspace at idle. While the
  // Library is shown nothing starts the engine or asks for the prose, a
  // workspace control waits (busy) for the workspace and then acts, and a
  // page that needs the catalog draws once it is in.
  for (const session of [null, SESSION]) {
    let release;
    const holdBoot = new Promise((r) => (release = r));
    const s = await open(dirs.lazy, '#library', null, { session, holdBoot });
    const { page } = s;
    await shown(page, 'Explore');
    const api = () => s.requests.filter((p) => p.startsWith('/api/'));
    const first = s.requests.findIndex((p) => p.startsWith('/api/'));
    assert.ok(
      first < 0 || s.requests.indexOf('/library/data/catalog.json') < first,
      'the Library asks before the workspace: ' + s.requests.join(' ')
    );
    await page.waitForTimeout(800);
    assert.ok(
      !api().some((p) => /engine\.json|browse_prose/.test(p)),
      `nothing asks for the engine or the prose before the workspace: ${api().join(' ')}`
    );
    // A workspace control clicked now waits for the workspace, then acts.
    const control = '#btn-saved';
    await page.click(control, { noWaitAfter: true });
    await page.waitForFunction(
      (c) => document.querySelector(c)?.getAttribute('aria-busy') === 'true',
      control
    );
    assert.equal(
      await page.evaluate(() => _workspaceReady),
      false,
      'the workspace waits on the held boot index'
    );
    release();
    await page.waitForFunction(
      (c) =>
        _workspaceReady &&
        !document.querySelector(c).hasAttribute('aria-busy') &&
        !!document.querySelector('#modal-saved.open'),
      control,
      { timeout: 30000 }
    );
    await page.waitForTimeout(1500);
    const onLibrary = api();
    assert.ok(
      !onLibrary.some((p) => /browse_prose/.test(p)) &&
        (session ? true : !onLibrary.some((p) => /engine\.json/.test(p))),
      `while the Library is shown the engine is not started and the prose not asked for: ${onLibrary.join(' ')}`
    );
    assert.equal(
      onLibrary.filter((p) => /browse_boot/.test(p)).length,
      1,
      'the boot index is asked for once'
    );
    if (session)
      assert.equal(await page.evaluate(() => app.cards.length), 1, 'the saved session is restored');
    await page.keyboard.press('Escape');
    await page.click('button.cm-tab[data-view="genre"]');
    await page.waitForFunction(
      () =>
        UI.view === 'genre' &&
        document.querySelector('#surface-genre')?.textContent.trim().length > 50
    );
    await page.waitForFunction(
      () => performance.getEntriesByType('resource').some((e) => /engine\.json/.test(e.name)),
      null,
      { timeout: 30000 }
    );
    assert.deepEqual(s.errors, []);
    await s.close();
  }

  // A page that needs the catalog, opened before the workspace is in, shows
  // its skeleton (it is not drawn against an empty catalog) and draws once
  // the workspace is in.
  {
    let release;
    const holdBoot = new Promise((r) => (release = r));
    const s = await open(dirs.lazy, '#library', null, { holdBoot });
    const { page } = s;
    await shown(page, 'Explore');
    const genreText = () =>
      page.evaluate(() => document.getElementById('surface-genre').textContent.trim());
    const skeleton = await genreText();
    await page.click('button.cm-tab[data-view="genre"]');
    await page.waitForFunction(
      () => UI.view === 'genre' && !document.getElementById('surface-genre').hidden
    );
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => _workspaceReady), false);
    assert.equal(await genreText(), skeleton, 'Genre is not drawn before the catalog is in');
    release();
    await page.waitForFunction(
      (before) =>
        _workspaceReady && document.getElementById('surface-genre').textContent.trim() !== before,
      skeleton,
      { timeout: 30000 }
    );
    assert.deepEqual(s.errors, []);
    await s.close();
  }

  // The in-page Lyrics handoff: uiOpenInLyrics hands one envelope to the
  // importer Lyrics registered. A valid envelope opens Lyrics on that text,
  // pushed so Back returns to the reading; a tampered one is refused and the
  // Library stays where it was; the recipe is untouched either way.
  {
    const s = await open(dirs.lazy, '#library/works');
    const { page } = s;
    await shown(page, 'Works');
    const handoff = (tamper) =>
      page.evaluate(async (tamper) => {
        const envelope = {
          protocol: CMLibraryImport.PROTOCOL,
          version: 1,
          handoffId: crypto.randomUUID(),
          draftId: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          payload: {
            text: 'The evening wind\nReturns the song',
            title: 'Handoff test',
            language: 'eng',
            scope: 'whole',
            provenance: {
              snapshotId: 'snapshot:one',
              unitId: 'unit:one',
              workId: 'work:one',
              editionId: 'edition:one',
              revisionId: 'revision:one',
              rights: { attribution: 'Source credit', notices: ['A notice'] },
            },
            lineage: [],
            declarations: [],
          },
        };
        envelope.digest = await CMLibraryImport.envelopeDigest(envelope);
        if (tamper) envelope.payload.text += ' (changed)';
        try {
          await uiOpenInLyrics(envelope);
          return { ok: true };
        } catch (e) {
          return { ok: false, message: e.message };
        }
      }, tamper);
    const refused = await handoff(true);
    assert.equal(refused.ok, false, 'a tampered envelope is refused');
    assert.equal(await page.evaluate(() => UI.view + location.hash), 'library#library/works');
    const opened = await handoff(false);
    assert.deepEqual(opened, { ok: true });
    await page.waitForFunction(() => UI.view === 'lyrics' && location.hash === '#lyrics');
    assert.equal(
      await page.evaluate(() => document.getElementById('lyrics-draft').value),
      'The evening wind\nReturns the song'
    );
    assert.equal(await page.evaluate(() => app.cards.length), 0, 'the recipe is untouched');
    await page.goBack();
    await shown(page, 'Works');
    assert.equal(
      await page.evaluate(() => location.hash),
      '#library/works',
      'Back returns to the reading'
    );
    assert.deepEqual(s.errors, []);
    await s.close();
  }

  // The section tabs: keyboard-operable (arrows, Home, End; only the selected
  // tab in the tab order) and selected by the route, on a deep link and on
  // Back/Forward as well as on a click.
  {
    const s = await open(dirs.lazy, '#library/rights');
    const { page } = s;
    await shown(page, 'Sources & rights');
    const tabs = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#surface-library [role="tab"]')]
          .map(
            (b) => `${b.dataset.id || 'explore'}:${b.getAttribute('aria-selected')}:${b.tabIndex}`
          )
          .join(' ')
      );
    const want = (sel) =>
      ['explore', '/works', '/rights']
        .map((id) => `${id}:${id === sel}:${id === sel ? 0 : -1}`)
        .join(' ');
    assert.equal(await tabs(), want('/rights'), 'a deep link selects its tab');
    await page.focus('#surface-library [role="tab"][aria-selected="true"]');
    await page.keyboard.press('Home');
    await shown(page, 'Explore');
    assert.equal(await tabs(), want('explore'));
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Explore');
    await page.keyboard.press('ArrowRight');
    await shown(page, 'Works');
    assert.equal(await tabs(), want('/works'));
    assert.equal(await page.evaluate(() => location.hash), '#library/works');
    await page.keyboard.press('End');
    await shown(page, 'Sources & rights');
    await page.keyboard.press('ArrowRight');
    await shown(page, 'Explore');
    assert.equal(await tabs(), want('explore'), 'ArrowRight wraps');
    await page.keyboard.press('ArrowLeft');
    await shown(page, 'Sources & rights');
    await page.goBack();
    await shown(page, 'Explore');
    assert.equal(await tabs(), want('explore'), 'Back moves the selection');
    await page.goBack();
    await page.goBack();
    await shown(page, 'Works');
    assert.equal(await tabs(), want('/works'));
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

  // The flagged embedded build: the same chunks inlined, no chunk fetched.
  {
    const s = await open(dirs.embedded, '#library/rights');
    await shown(s.page, 'Sources & rights');
    // Data and artwork are fetched as on the lazy page; no chunk file is.
    assert.deepEqual(
      s.requests.filter((p) => p.includes('/library/code/')),
      [],
      'the embedded build fetches no chunk'
    );
    assert.deepEqual(s.errors, []);
    await s.close();
  }

  await browser.close();
  fs.rmSync(temp, { recursive: true, force: true });
  console.log(
    'LIBRARY SHELL: PASS — default build byte-identical with no Library code; flagged lazy: within the Library byte budgets (stub, chunks, growth over the default build), route, core chunk once with sha384 integrity, sub-routes push, Back/Forward pop, nav resumes, head preloads reused, hover prefetches core and catalog once, deferred boot (Library before the workspace, no engine or prose while shown, a held control acts once it is in, the saved session kept and restored, Genre waits as a skeleton and draws once it is in), the Lyrics handoff (opens the text pushed, Back returns, a tampered envelope refused, the recipe untouched), section tabs keyboard-operable and route-selected (deep link, click, Back), a tampered chunk refused with Reload; flagged embedded: inlined, no chunk fetched'
  );
})().catch((error) => {
  console.error('LIBRARY SHELL: FAIL —', error.stack || error);
  process.exit(1);
});

// Live: open a real reading with the sound lens and the declarations inspector.
// Read-only: every /chat request and every non-GET request is aborted, so nothing is billed or written.
const { chromium } = require(process.argv[2] + '/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const scripts = [], blocked = [], errors = [], lib = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  await p.route('**/*', (r) => {
    const q = r.request(), u = new URL(q.url());
    if (/\/chat(\/|$)/.test(u.pathname) || q.method() !== 'GET') { blocked.push(q.method() + ' ' + u.pathname); return r.abort(); }
    if (/library\/code\/.*\.js/.test(u.pathname)) scripts.push(u.pathname.split('/').pop());
    if (/\/library\/v1\//.test(u.pathname)) lib.push(u.pathname.replace(/reading_[0-9a-f-]+/, 'reading_…'));
    return r.continue();
  });
  const at = new Date().toISOString();
  await p.goto('https://codexmusica.com/codex.html#library/read/reading_570567e3-ba7f-56f3-a1bf-f06c6a8d9b81?lens=sound', { timeout: 60000 });
  await p.waitForSelector('#surface-library .rd-paper .rd-line', { timeout: 60000 }).catch(() => null);
  const lines = await p.$$eval('#surface-library .rd-paper .rd-line', (n) => n.length).catch(() => 0);
  if (await p.isVisible('#surface-library [data-rd="sheet"]').catch(() => false)) await p.click('#surface-library [data-rd="sheet"]');
  const analyze = await p.waitForSelector('#surface-library [data-act="analyze"]', { timeout: 20000 }).then(() => true).catch(() => false);
  const decl = await p.$('#surface-library [data-act="decl"]').then((x) => !!x);
  await p.waitForTimeout(2000);
  console.log(JSON.stringify({ at, reader_lines: lines, analyze_button: analyze, declarations_button: decl,
    chunks_loaded: [...new Set(scripts)], library_api_gets: [...new Set(lib)], blocked, errors }, null, 1));
  await b.close();
})();

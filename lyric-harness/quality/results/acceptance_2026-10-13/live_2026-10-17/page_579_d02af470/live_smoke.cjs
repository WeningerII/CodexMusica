// Live, read-only: open the real Library page; /chat requests are aborted (never billed).
const { chromium } = require(process.argv[2] + '/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const scripts = [], chat = [], errors = [], lib = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (/\/chat(\/|$|\?)/.test(new URL(u).pathname)) { chat.push(u); return r.abort(); }
    if (/library\/code\/.*\.js/.test(u)) scripts.push(u.split('/').pop());
    if (/\/library\/v1\//.test(u)) lib.push(r.request().method() + ' ' + new URL(u).pathname);
    return r.continue();
  });
  const t0 = new Date().toISOString();
  await p.goto('https://codexmusica.com/codex.html#library', { waitUntil: 'load', timeout: 60000 });
  await p.waitForSelector('#surface-library', { state: 'attached', timeout: 30000 });
  await p.waitForTimeout(6000);
  const text = await p.evaluate(() => document.querySelector('#surface-library')?.innerText || '');
  console.log(JSON.stringify({ at: t0, scripts: [...new Set(scripts)], library_api: [...new Set(lib)], chat_aborted: chat.length,
    errors, surface_chars: text.length, surface_head: text.slice(0, 300) }, null, 1));
  await b.close();
})();

// Live, read-only: what the page shows after Run review on the legacy P-A row. /chat and mcp host aborted.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
(async () => {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const exe = fs.readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).map((n) => path.join(base, n, 'chrome-linux/chrome')).find(fs.existsSync);
  const b = await chromium.launch({ headless: true, executablePath: exe, proxy: { server: process.env.HTTPS_PROXY }, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ ignoreHTTPSErrors: false, serviceWorkers: 'block' });
  const posts = [];
  await ctx.route('**/*', (r) => { const u = r.request().url(); if (/\/chat/.test(u) || /mcp\.codexmusica\.com/.test(u)) { posts.push(r.request().method() + ' ' + u); return r.abort(); } return r.continue(); });
  const p = await ctx.newPage();
  await p.goto('https://codexmusica.com/codex.html#lyrics');
  await p.waitForFunction(() => typeof LY !== 'undefined' && LY.model && UI.ready, null, { timeout: 120000 });
  await p.locator('#lyrics-draft').fill('[SETUP — rhyme groups — 1.T4,2.end]\nOh--oh, (ah) oh my love\na song for us above');
  await p.locator('#lyrics-draft').blur();
  await p.click('.ly-head [data-ui="ly-run-review"]');
  await p.waitForTimeout(1500);
  const seen = await p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const live = [...document.querySelectorAll('[aria-live],[role=status],[role=alert]')].filter(vis).map((e) => e.innerText.trim()).filter(Boolean);
    const notes = [...document.querySelectorAll('[class*=notice],[class*=warn],[class*=refus],[class*=status],[class*=hint]')].filter(vis).map((e) => e.innerText.trim()).filter((t) => t && t.length < 600);
    return { live, notes: [...new Set(notes)].slice(0, 12), head: document.querySelector('.ly-head')?.innerText.slice(0, 300) };
  });
  console.log(JSON.stringify({ posts, ...seen }, null, 1));
  await p.screenshot({ path: process.argv[2] || 'after_run_review.png', fullPage: false });
  await b.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });

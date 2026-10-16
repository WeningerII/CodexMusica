// Live, read-only, post-#569 page: legacy P-A row -> Run review; record any /chat POST body and the page's live-region text.
// /chat and mcp.codexmusica.com requests are recorded then aborted. usage: node visible2.js <outdir>
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const OUT = path.resolve(process.argv[2] || '.');
const DRAFTS = {
  voices_off: '[SETUP — rhyme groups — 1.T4,2.end]\nOh--oh, (ah) oh my love\na song for us above',
  voices_sung: '[SETUP — rhyme groups — 1.T4,2.end]\n[SETUP — voices — parentheses are sung]\nOh--oh, (ah) oh my love\na song for us above',
};
(async () => {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const exe = fs.readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).map((n) => path.join(base, n, 'chrome-linux/chrome')).find(fs.existsSync);
  const b = await chromium.launch({ headless: true, executablePath: exe, proxy: { server: process.env.HTTPS_PROXY }, args: ['--no-sandbox'] });
  const all = {};
  for (const [name, draft] of Object.entries(DRAFTS)) {
    const ctx = await b.newContext({ serviceWorkers: 'block' });
    const reqs = [];
    await ctx.route('**/*', (r) => { const q = r.request(); const u = q.url(); if (/\/chat/.test(u) || /mcp\.codexmusica\.com/.test(u)) { reqs.push({ method: q.method(), url: u, body: q.postData() }); return r.abort(); } return r.continue(); });
    const p = await ctx.newPage();
    const resp = await p.goto('https://codexmusica.com/codex.html#lyrics');
    const html = await resp.body();
    await p.waitForFunction(() => typeof LY !== 'undefined' && LY.model && UI.ready, null, { timeout: 120000 });
    await p.locator('#lyrics-draft').fill(draft); await p.locator('#lyrics-draft').blur();
    let btn = p.locator('[data-ui="ly-run-review"]:visible').first();
    if (!(await btn.count())) { await p.locator('[data-ui="ly-tab"][data-id="review"]').first().click(); btn = p.locator('[data-ui="ly-run-review"]:visible').first(); }
    await btn.click();
    await p.waitForTimeout(2000);
    const seen = await p.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      return { live: [...document.querySelectorAll('[aria-live],[role=status],[role=alert]')].filter(vis).map((e) => e.innerText.trim()).filter(Boolean),
               editor: document.querySelector('#lyrics-draft')?.value };
    });
    const posts = reqs.filter((r) => r.method === 'POST');
    const decl = posts.map((r) => { try { const j = JSON.parse(r.body); return j?.context?.declarations ?? j?.declarations ?? null; } catch { return 'unparsed'; } });
    all[name] = { sha256: require('crypto').createHash('sha256').update(html).digest('hex'), requests: reqs.map((r) => r.method + ' ' + r.url), chat_posts: posts.length, declarations: decl, ...seen };
    await p.screenshot({ path: path.join(OUT, `after_run_review_${name}.png`) });
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'visible2.json'), JSON.stringify(all, null, 1));
  console.log(JSON.stringify(all, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });

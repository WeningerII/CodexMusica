// Optional browser regression check. Use Node + Playwright and an installed Chromium.
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const base = pathToFileURL(path.join(__dirname, 'dist/index.html')).href;
const queries = [
  ['penfyr','Englyn'],['milwr','Englyn'],['unodl union','Englyn'],
  ['deibhidhe','Irish syllabic quatrains'],['rannaigheacht','Irish syllabic quatrains'],
  ['séadna','Irish syllabic quatrains'],['ae freislighe','Irish syllabic quatrains'],
  ['haikai no renga','Renga / renku'],['haikai','Renga / renku'],['kasen','Renga / renku'],
  ['jump-rope rhyme','Skipping / clapping rhyme'],['AAB blues','12-bar blues'],
  ['blues stanza','12-bar blues'],['step-down line','Triadic line'],['Cinquain','Cinquain'],
];
async function run() {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true});
  try {
    for (const width of [1280,390]) {
      const page = await browser.newPage({viewport:{width,height:844}});
      const errors=[], outbound=[];
      page.on('pageerror',e=>errors.push(String(e)));
      page.on('request',r=>{if(/^https?:/.test(r.url())) outbound.push(r.url())});
      await page.goto(base);
      for (const [term,title] of queries) {
        await page.getByRole('button',{name:/Find a form/}).click();
        const box=page.getByRole('searchbox');
        await box.fill(term);
        const target=page.locator('#results .result').filter({has:page.getByText(title,{exact:true})});
        assert.equal(await target.count(),1,term);
        await target.click();
        await page.getByRole('heading',{name:title,exact:true,level:1}).waitFor();
        assert.equal(await page.getByRole('dialog').count(),0);
      }
      await page.getByRole('button',{name:/Find a form/}).click();
      const box=page.getByRole('searchbox');
      await box.fill('Binary');
      await box.press('Enter');
      await page.getByRole('heading',{name:'Binary',exact:true,level:1}).waitFor();
      assert.equal(await page.getByRole('dialog').count(),0);
      assert.match(await page.locator('#reviewNote').innerText(),/Sources differ/);
      await page.goto(base+'#petrarchan-sonnet');
      const miltonic=page.getByRole('button',{name:'Explore Miltonic sonnet',exact:true});
      const item=page.locator('li').filter({has:miltonic});
      assert.match(await item.innerText(),/Has variant/);
      await item.locator('summary').click();
      assert.match(await item.innerText(),/Miltonic sonnet → Petrarchan sonnet/);
      assert.doesNotMatch(await item.innerText(),/Petrarchan sonnet → Miltonic sonnet/);
      for (const result of [errors,outbound]) assert.deepEqual(result,[]);
      await page.close();
      console.log(width+'px: all '+queries.length+' searches, keyboard selection, directional evidence and offline checks passed');
    }
  } finally { await browser.close() }
}
run().catch(e=>{console.error(e);process.exitCode=1});


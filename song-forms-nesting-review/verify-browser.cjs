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
const reportedQueries = [
  ['regular ode', 'Pindaric ode', 'Irregular ode'],
  ['verse-refrain', 'Strophic with refrain', 'Verse-refrain with introductory verse'],
  ['AB', 'Binary', 'AABA 32-bar'],
  ['ABA', 'Ternary', 'AABA 32-bar'],
  ['AAB', 'Bar form', 'AABA 32-bar'],
  ['chain', 'Cumulative song', 'Hammer song / chain-gang song']
];

async function checkCatalogRankings(page) {
  // Use the live finder for every spelling, including aliases split from a multi-name field.
  // If multiple records claim the same exact term, all owners must precede looser matches.
  const result = await page.evaluate(() => {
    const terms = new Map();
    for (const form of FORMS) {
      const groups = [[form.name], form.aliases.split(','), form.search_terms];
      groups.forEach((spellings, tier) => {
        for (const spelling of spellings) {
          const key = normal(spelling);
          if (!key) continue;
          if (!terms.has(key)) terms.set(key, new Map());
          const owners = terms.get(key);
          owners.set(form.id, Math.min(tier, owners.get(form.id) ?? Infinity));
        }
      });
    }
    const failures = [];
    for (const [term, owners] of terms) {
      query.value = term;
      showResults();
      const actual = [...document.querySelectorAll('#results .result span')].map(el => el.textContent);
      const expected = FORMS.filter(form => owners.has(form.id))
        .sort((a, b) => owners.get(a.id) - owners.get(b.id)).map(form => titleCase(form.name));
      if (expected.some((name, i) => actual[i] !== name)) failures.push({term, expected, actual: actual.slice(0, expected.length)});
    }
    return {forms: FORMS.length, terms: terms.size, failures};
  });
  assert.equal(result.forms, 364);
  assert.deepEqual(result.failures, []);
  return result.terms;
}
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
      const count = await checkCatalogRankings(page);
      for (const [term, owner, other] of reportedQueries) {
        await box.fill(term);
        const names = await page.locator('#results .result span').allTextContents();
        assert.equal(names[0], owner, term);
        assert.ok(names.includes(other), 'Alternative must remain for ' + term);
      }
      await page.locator('#filter').selectOption('D');
      await box.fill('AB');
      assert.ok(!(await page.locator('#results .result span').allTextContents()).includes('Binary'));
      await page.locator('#filter').selectOption('');
      await box.fill('AB');
      await box.press('Enter');
      await page.getByRole('heading',{name:'Binary',exact:true,level:1}).waitFor();
      assert.equal(await page.getByRole('dialog').count(),0);
      assert.match(await page.locator('#reviewNote').innerText(),/Contested pattern/);
      await page.goto(base+'#petrarchan-sonnet');
      const miltonic=page.getByRole('button',{name:'Explore Miltonic sonnet',exact:true});
      const item=page.locator('li').filter({has:miltonic});
      assert.match(await item.innerText(),/Has variant/);
      await item.locator('summary').click();
      assert.match(await item.innerText(),/Miltonic sonnet → Petrarchan sonnet/);
      assert.doesNotMatch(await item.innerText(),/Petrarchan sonnet → Miltonic sonnet/);
      for (const result of [errors,outbound]) assert.deepEqual(result,[]);
      await page.close();
      console.log(width+'px: '+count+' exact terms, '+reportedQueries.length+' reported rankings and alternatives, '+queries.length+' navigation checks, family filtering, keyboard selection, directional evidence and offline checks passed');
    }
  } finally { await browser.close() }
}
run().catch(e=>{console.error(e);process.exitCode=1});


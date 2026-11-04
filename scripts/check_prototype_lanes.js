#!/usr/bin/env node
'use strict';
/* global document */
// check_prototype_lanes.js — the #670 feature lanes, mounted for real.
//
// check_prototype_hosts.js proves the shell side with probe lanes; each
// lane's own scenario (prototype/scenarios/<lane>/) proves the lane against
// fixtures. Neither shows the two together. This gate loads /prototype/
// with the lanes' committed files and the shell's real ctx, built from the
// committed catalog and Library data, and checks what a person sees there.
// It fails when:
//
//   LIBRARY (#741). The shelves are not catalog.json's, in order, named as the
//   live Library names them; a shelf's count is not "N of total"; Show more
//   does not add the next 24 readable rows of collections.json, keep the cards
//   already shown, update the count and move focus to the first new card;
//   Play first reading does not say the reader isn't here yet, for a preview
//   card and an appended one; Select readable units does not press; Artwork
//   credit does not say artwork.json's credit; or the shelves are lost across
//   a route switch.
//   BROWSE (#742). The cards are not api/traditions/index.json, in order; a
//   selected tradition's detail does not show data/geo.json's place and the
//   provenance its review status implies (model reviewed, unreviewed, none for
//   no fixed origin); selecting moves focus; the selection is not restored
//   after a reload; or the map host claims a map the prototype doesn't have.
//   BOTH. A route change does not focus the panel heading, the page scrolls
//   sideways at 320 px, or the page throws.
//
//   node scripts/check_prototype_lanes.js
//
// CHROMIUM_PATH may name a Chromium executable.

const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { start } = require('./_pages_server.js');

const root = path.resolve(__dirname, '..');
const json = (...p) => JSON.parse(fs.readFileSync(path.join(root, ...p), 'utf8'));

const problems = [];
let checks = 0;
const expect = (ok, what) => {
  checks++;
  if (!ok) problems.push(what);
};

async function open(browser, srv, hash, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === srv.url ? route.continue() : route.abort()
  );
  await page.goto(`${srv.url}/prototype/${hash}`);
  return { context, page, errors };
}
// A route change focuses the panel heading once its hashchange has run.
const headingFocused = (page, id) =>
  page
    .waitForFunction((h) => document.activeElement && document.activeElement.id === h, id, {
      timeout: 3000,
    })
    .then(
      () => true,
      () => false
    );
const status = (page) => page.locator('#proto-status').textContent();
const noSideScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

async function library(browser, srv) {
  const catalog = json('library', 'data', 'catalog.json');
  const rows = json('library', 'data', 'collections.json').collections;
  const artwork = json('library', 'data', 'artwork.json').artwork;
  const core = fs.readFileSync(path.join(root, 'src', 'library', 'core.js'), 'utf8');
  const names = Function(`return (${/const LANGUAGE_NAMES = (\{[^}]*\});/.exec(core)[1]})`)();
  const { context, page, errors } = await open(browser, srv, '#library');
  const host = page.locator('[data-feature-host="library"]');
  await host.locator('section[data-language]').first().waitFor({ timeout: 20000 });

  const shelves = await host.locator('section[data-language]').evaluateAll((list) =>
    list.map((s) => ({
      language: s.dataset.language,
      heading: s.querySelector('h2').textContent,
      count: s.querySelector('p').textContent,
      cards: [...s.querySelectorAll('[data-collection]')].map((c) => c.dataset.collection),
    }))
  );
  expect(
    JSON.stringify(shelves.map((s) => s.language)) ===
      JSON.stringify(catalog.shelves.map((s) => s.language)),
    `library: shelves [${shelves.map((s) => s.language)}] are not catalog.json's, in order`
  );
  for (const s of catalog.shelves) {
    const got = shelves.find((x) => x.language === s.language) || {};
    expect(
      got.heading === (names[s.language] || s.language),
      `library: the ${s.language} shelf is headed "${got.heading}", the live Library says "${names[s.language]}"`
    );
    expect(
      JSON.stringify(got.cards) === JSON.stringify(s.cards.map((c) => c[0])),
      `library: the ${s.language} shelf's cards are not catalog.json's`
    );
    expect(
      (got.count || '').startsWith(`${s.cards.length} of ${s.total} collections`),
      `library: the ${s.language} count says "${got.count}"`
    );
  }

  // Show more, on the English shelf.
  const eng = host.locator('section[data-language="eng"]');
  const engRows = rows.filter((r) => r[3] > 0 && r[2] === 'eng');
  const preview = catalog.shelves.find((s) => s.language === 'eng');
  await eng.evaluate((s) => {
    for (const c of s.querySelectorAll('[data-collection]')) c.__kept = true;
  });
  const more = eng.locator('.library-prototype-more');
  await more.focus();
  await more.press('Enter');
  const next = engRows[preview.cards.length][0];
  await page
    .waitForFunction(
      (id) => document.activeElement && document.activeElement.dataset.collection === id,
      next,
      { timeout: 15000 }
    )
    .catch(() => {});
  const after = await eng.evaluate((s) => ({
    ids: [...s.querySelectorAll('[data-collection]')].map((c) => c.dataset.collection),
    kept: [...s.querySelectorAll('[data-collection]')].filter((c) => c.__kept).length,
    count: s.querySelector('p').textContent,
    focus: document.activeElement && document.activeElement.dataset.collection,
  }));
  const want = engRows.slice(0, preview.cards.length + 24).map((r) => r[0]);
  expect(
    JSON.stringify(after.ids) === JSON.stringify(want),
    'library: Show more did not add the next 24 readable English rows of collections.json, in order'
  );
  expect(
    after.kept === preview.cards.length,
    `library: Show more replaced cards (${after.kept} of ${preview.cards.length} kept)`
  );
  expect(
    after.count.startsWith(`${preview.cards.length + 24} of ${preview.total} collections`),
    `library: after Show more the count says "${after.count}"`
  );
  expect(
    after.focus === next,
    `library: after Show more focus is on ${after.focus}, not the first new card`
  );

  // Play first reading: a preview card, then an appended one.
  for (const id of [preview.cards[0][0], next]) {
    await page.evaluate(() => (document.getElementById('proto-status').textContent = ''));
    await eng
      .locator(`[data-collection="${id}"] button`, { hasText: 'Play first reading' })
      .click();
    await page
      .waitForFunction(
        () =>
          /isn’t part of this prototype/.test(document.getElementById('proto-status').textContent),
        null,
        { timeout: 15000 }
      )
      .catch(() => {});
    const said = await status(page);
    expect(
      /The reader isn’t part of this prototype yet/.test(said),
      `library: Play on ${id} said "${said}"`
    );
  }
  // Select readable units.
  const select = eng.locator(`[data-collection="${next}"] button`, {
    hasText: 'Select readable units',
  });
  await select.click();
  await page
    .waitForFunction(
      (id) => {
        const b = [...document.querySelectorAll(`[data-collection="${id}"] button`)].find((x) =>
          /Select/.test(x.textContent)
        );
        return b && b.getAttribute('aria-pressed') === 'true';
      },
      next,
      { timeout: 15000 }
    )
    .catch(() => {});
  expect(
    (await select.getAttribute('aria-pressed')) === 'true',
    'library: Select readable units did not press'
  );
  // Artwork credit, on a card that has art.
  const withArt = catalog.shelves.flatMap((s) => s.cards).find((c) => c[4]);
  const credit = artwork.find((a) => a.id === withArt[4]).credit;
  await host
    .locator(`[data-collection="${withArt[0]}"] button`, { hasText: 'Artwork credit' })
    .click();
  await page
    .waitForFunction((t) => document.getElementById('proto-status').textContent === t, credit, {
      timeout: 15000,
    })
    .catch(() => {});
  expect((await status(page)) === credit, `library: Artwork credit said "${await status(page)}"`);

  // A route switch keeps the shelves; the heading takes focus.
  await page.locator('[data-route="genre"]').click();
  await page.locator('[data-route="library"]').click();
  const kept = await eng.evaluate(
    (s) => [...s.querySelectorAll('[data-collection]')].filter((c) => c.__kept).length
  );
  // Mounted once: give a second mount time to land, then count.
  await page.waitForTimeout(1500);
  const mounts = await page.evaluate(() => ({
    hosts: document.querySelectorAll('[data-feature-host="library"]').length,
    shelves: document.querySelectorAll('[data-feature-host="library"] section[data-language]')
      .length,
  }));
  expect(
    mounts.hosts === 1 && mounts.shelves === catalog.shelves.length,
    `library: after a route switch the panel has ${mounts.hosts} lane host(s) and ${mounts.shelves} shelves`
  );
  expect(kept === preview.cards.length, 'library: the shelves were rebuilt across a route switch');
  expect(
    await headingFocused(page, 'h-library'),
    'library: the route change did not focus the Library heading'
  );
  expect(!errors.length, `library: uncaught errors: ${errors.join(' | ')}`);
  await context.close();

  const narrow = await open(browser, srv, '#library', 320);
  await narrow.page
    .locator('[data-feature-host="library"] section[data-language]')
    .first()
    .waitFor({ timeout: 20000 });
  expect(await noSideScroll(narrow.page), 'library: the page scrolls sideways at 320 px');
  expect(!narrow.errors.length, `library (320): uncaught errors: ${narrow.errors.join(' | ')}`);
  await narrow.context.close();
}

async function browse(browser, srv) {
  const index = json('api', 'traditions', 'index.json').items;
  const geo = json('data', 'geo.json');
  const meta = json('data', 'geo-meta.json');
  const none = new Set(json('data', 'no-fixed-origin.json').ids);
  const reviewed = new Set(meta.reviewed);
  const verified = new Set(meta.verified);
  const { context, page, errors } = await open(browser, srv, '#browse');
  const host = page.locator('[data-feature-host="browse"]');
  await host.locator('.discovery-card').first().waitFor({ timeout: 30000 });
  const names = await host
    .locator('.discovery-card')
    .evaluateAll((b) => b.map((x) => x.textContent));
  expect(
    names.length === index.length && names.every((n, i) => n === index[i].name),
    `browse: ${names.length} cards, not api/traditions/index.json's ${index.length} in order`
  );
  const pick = {
    reviewed: index.find((t) => !none.has(t.id) && reviewed.has(t.id) && !verified.has(t.id)),
    unreviewed: index.find((t) => !none.has(t.id) && !reviewed.has(t.id) && !verified.has(t.id)),
    none: index.find((t) => none.has(t.id)),
  };
  const expected = {
    reviewed: /^Model reviewed location; not human verified\./,
    unreviewed: /^Unreviewed location; not human verified\.$/,
    none: /^No coordinate review applies\.$/,
  };
  for (const [kind, t] of Object.entries(pick)) {
    const card = host.locator('.discovery-card').nth(index.indexOf(t));
    await card.click();
    const d = await host.locator('.discovery-detail').evaluate((el) => ({
      hidden: el.hidden,
      name: el.querySelector('h2').textContent,
      where: el.querySelector('[data-location]').textContent,
      review: el.querySelector('[data-provenance]').textContent,
    }));
    const focusOnCard = await card.evaluate((b) => document.activeElement === b);
    const g = geo[t.id];
    const where =
      kind === 'none'
        ? 'No fixed origin; this tradition remains available to browse.'
        : `${g[2]} · ${g[3]} · ${g[0]}, ${g[1]}`;
    expect(!d.hidden && d.name === t.name, `browse: selecting ${t.id} showed "${d.name}"`);
    expect(
      d.where === where,
      `browse: ${t.id}'s place says "${d.where}", data/geo.json says "${where}"`
    );
    expect(expected[kind].test(d.review), `browse: ${t.id} (${kind}) says "${d.review}"`);
    expect(focusOnCard, `browse: selecting ${t.id} moved focus off its card`);
  }
  expect(
    /not connected/.test(await host.locator('.discovery-map').textContent()),
    'browse: the map host claims a map the prototype does not have yet'
  );
  await page.reload();
  await host
    .locator('.discovery-detail:not([hidden]) h2')
    .waitFor({ timeout: 30000 })
    .catch(() => {});
  const restored = await host.locator('.discovery-detail h2').textContent();
  expect(
    restored === pick.none.name,
    `browse: after a reload the selection is "${restored}", not ${pick.none.name}`
  );
  await page.locator('[data-route="lyrics"]').click();
  await page.locator('[data-route="browse"]').click();
  expect(
    await headingFocused(page, 'h-browse'),
    'browse: the route change did not focus the Browse heading'
  );
  expect(!errors.length, `browse: uncaught errors: ${errors.join(' | ')}`);
  await context.close();

  const narrow = await open(browser, srv, '#browse', 320);
  await narrow.page
    .locator('[data-feature-host="browse"] .discovery-card')
    .first()
    .waitFor({ timeout: 30000 });
  expect(await noSideScroll(narrow.page), 'browse: the page scrolls sideways at 320 px');
  await narrow.context.close();
}

(async () => {
  const lanes = {
    library: 'prototype/features/library/explore.js',
    browse: 'prototype/features/browse-map/discovery.js',
  };
  const present = Object.keys(lanes).filter((l) => fs.existsSync(path.join(root, lanes[l])));
  const srv = await start({ root });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  try {
    // A step that can't run (a missing card, a control that never appears)
    // is a failure of that lane, named, not a crash of the gate.
    for (const [lane, run] of [
      ['library', library],
      ['browse', browse],
    ]) {
      if (!present.includes(lane)) continue;
      await run(browser, srv).catch((e) =>
        expect(
          false,
          `${lane}: stopped at a step that could not run: ${String(e.message).split('\n')[0]}`
        )
      );
    }
  } finally {
    await browser.close();
    await srv.close();
  }
  if (problems.length) {
    console.error(`check_prototype_lanes: FAIL — ${problems.length} of ${checks} checks`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log(
    `check_prototype_lanes: ${checks}/${checks} checks pass (lanes mounted: ${present.join(', ') || 'none'})`
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
'use strict';
/* global window, document, localStorage, Storage, getComputedStyle */
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
//   live Library names them; a shelf's count is not "N of total", with
//   thousands separators; Show more
//   does not add the next 24 readable rows of collections.json, keep the cards
//   already shown, update the count and move focus to the first new card;
//   Play first reading does not say the reader isn't here yet, for a preview
//   card and an appended one; Play does not open read-aloud right below the
//   reader, reading the first sung line, with Stop stopping the device once; Select readable units does not press; Artwork
//   credit does not say artwork.json's credit; or the shelves are lost across
//   a route switch.
//   Library also fails when the focused new card has no accessible name (its
//   heading), or Select readable units looks the same pressed (Jony, L1/L2).
//   BROWSE (#742). The cards are not api/traditions/index.json, in order, or
//   are more than one tab stop (Jony, B1); a
//   selected tradition's detail does not show data/geo.json's place and the
//   provenance its review status implies (model reviewed, unreviewed, none for
//   no fixed origin); selecting moves focus; the selection is not restored
//   after a reload; or the map host claims a map the prototype doesn't have.
//   LYRICS (#743). The text the editor reports is not what the shell stores,
//   byte for byte (punctuation, notation, a tab, a trailing newline), or is
//   not handed back after a reload; the editor node is replaced across a
//   route switch; or a refused save is not said ("Not saved") with the text
//   kept in the editor.
//   CREDITS (#747). The census doesn't show catalog.json's readable units,
//   an artwork.json credit is missing, or Inspect all doesn't say the Works
//   list isn't here yet.
//   METHODS (#750). Opened, the reference doesn't count all of methods.json,
//   or a search doesn't count what the native predicate (name, aliases,
//   required capabilities) matches.
//   ALL. A route change does not focus the panel heading, the page scrolls
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

async function open(browser, srv, hash, width = 1280, init = null) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  if (init) await context.addInitScript(init);
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
// Counts as a person reads them, with thousands separators (Jony's L3, #744).
const fmt = (n) => n.toLocaleString('en-US');
const status = (page) => page.locator('#proto-status').textContent();
const noSideScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

// A device with one English voice that records what it is asked to say and
// never finishes on its own, so the first line is the one being read.
function englishDevice() {
  const log = (window.__device = { said: [], cancels: 0 });
  const voices = [{ voiceURI: 'en', name: 'English', lang: 'en-GB', default: true }];
  const t = new EventTarget();
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: class {
      constructor(text) {
        this.text = text;
      }
    },
  });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => voices,
      speak: (u) => log.said.push(u.text),
      cancel: () => log.cancels++,
      addEventListener: (...a) => t.addEventListener(...a),
      removeEventListener: (...a) => t.removeEventListener(...a),
    },
  });
}

async function library(browser, srv) {
  const catalog = json('library', 'data', 'catalog.json');
  const rows = json('library', 'data', 'collections.json').collections;
  const artwork = json('library', 'data', 'artwork.json').artwork;
  const core = fs.readFileSync(path.join(root, 'src', 'library', 'core.js'), 'utf8');
  const names = Function(`return (${/const LANGUAGE_NAMES = (\{[^}]*\});/.exec(core)[1]})`)();
  const { context, page, errors } = await open(browser, srv, '#library', 1280, englishDevice);
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
      (got.count || '').startsWith(`${fmt(s.cards.length)} of ${fmt(s.total)} collections`),
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
    // What a screen reader says for the focused card (Jony's L1): its name.
    focusName: (() => {
      const a = document.activeElement;
      const ids = (a && a.getAttribute('aria-labelledby')) || '';
      return ids
        .split(/\s+/)
        .map((id) =>
          id && document.getElementById(id) ? document.getElementById(id).textContent : ''
        )
        .join(' ')
        .trim();
    })(),
    focusHeading:
      (document.activeElement &&
        document.activeElement.querySelector('h3') &&
        document.activeElement.querySelector('h3').textContent.trim()) ||
      '',
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
    after.count.startsWith(
      `${fmt(preview.cards.length + 24)} of ${fmt(preview.total)} collections`
    ),
    `library: after Show more the count says "${after.count}"`
  );
  expect(
    after.focus === next,
    `library: after Show more focus is on ${after.focus}, not the first new card`
  );
  expect(
    after.focusName && after.focusName === after.focusHeading,
    `library: the focused new card's accessible name is "${after.focusName}", its heading "${after.focusHeading}"`
  );

  // Play first reading: a preview card, then an appended one. The reader
  // (#757) opens on the collection's first readable unit, as production's
  // Play does, with that reading's own title and focus on it.
  const zlib = require('node:zlib');
  const gz = (...p) =>
    JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'library', 'data', ...p))));
  const headOf = (unitId) => {
    const hh = unitId.slice(8, 10);
    const key = gz('u', `${hh}.json.gz`).units.find((u) => u[0] === unitId)[1];
    return gz('r', hh, unitId, key, 'head.json.gz');
  };
  const firstOf = (cid) =>
    preview.cards.find((c) => c[0] === cid)?.[5] || gz('c', `${cid}.json.gz`).readable_ids[0];
  for (const id of [preview.cards[0][0], next]) {
    const head = headOf(firstOf(id));
    await eng
      .locator(`[data-collection="${id}"] button`, { hasText: 'Play first reading' })
      .click();
    const reader = page.locator('[data-feature-host="libraryreading"]');
    const title = reader.locator('h2', { hasText: head.title });
    const shown = await title.waitFor({ timeout: 15000 }).then(
      () => true,
      () => false
    );
    expect(shown, `library: Play on ${id} did not open its first reading, "${head.title}"`);
    expect(
      (await page.locator('[data-feature-host="libraryreading"]').count()) === 1,
      `library: Play on ${id} left more than one reader open`
    );
    const focused = await page.evaluate(
      () => document.activeElement && document.activeElement.textContent
    );
    expect(focused === head.title, `library: after Play on ${id}, focus is on "${focused}"`);
    const said = await status(page);
    expect(
      said === `Page 1 of ${head.page_count}`,
      `library: Play on ${id} said "${said}", not "Page 1 of ${head.page_count}"`
    );
    // Read-aloud (#758) opens below the reader and, because Play opened it,
    // starts on the reading's first sung line.
    const first = head.lines.find((l) => l[4] != null && l[1])[1];
    const heard = await page
      .waitForFunction((t) => window.__device.said.at(-1) === t, first, { timeout: 5000 })
      .then(
        () => true,
        () => false
      );
    const hosts = await page.evaluate(() =>
      [...document.querySelectorAll('[data-feature-host]')].map((h) => h.dataset.featureHost)
    );
    expect(
      hosts.filter((h) => h === 'libraryspeech').length === 1 &&
        hosts.indexOf('libraryspeech') === hosts.indexOf('libraryreading') + 1,
      `library: after Play on ${id}, read-aloud is not one lane right below the reader (${hosts.join(', ')})`
    );
    expect(
      heard,
      `library: Play on ${id} did not start reading aloud at "${first}" (heard ${JSON.stringify(await page.evaluate(() => window.__device.said))})`
    );
    expect(
      (await page
        .locator('[data-feature-host="libraryspeech"] button', { hasText: 'Stop' })
        .count()) === 1,
      `library: while reading ${id} aloud, there is no Stop button`
    );
  }
  // Stop stops the device and offers to read again.
  const cancels = await page.evaluate(() => window.__device.cancels);
  await page.locator('[data-feature-host="libraryspeech"] button', { hasText: 'Stop' }).click();
  expect(
    (await page.evaluate(() => window.__device.cancels)) === cancels + 1 &&
      (await page
        .locator('[data-feature-host="libraryspeech"] button', { hasText: 'Read this work' })
        .count()) === 1,
    'library: Stop did not stop the device once and offer "Read this work"'
  );
  // Select readable units.
  const select = eng.locator(`[data-collection="${next}"] button`, {
    hasText: 'Select readable units',
  });
  // A pressed state a person can see, not only aria-pressed (Jony's L2).
  const look = (b) =>
    b.evaluate((el) => {
      const c = getComputedStyle(el);
      return [
        c.backgroundColor,
        c.color,
        c.borderTopWidth,
        c.borderTopColor,
        c.fontWeight,
        c.outlineStyle,
      ].join('|');
    });
  const unpressed = await look(select);
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
  expect(
    (await look(select)) !== unpressed,
    'library: Select readable units looks the same pressed as unpressed'
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

async function lyrics(browser, srv) {
  // Punctuation, notation, typographic quotes, a tab and a trailing newline,
  // the cases the lane's own scenario pins, now through the shell's draft.
  const text = 'Verse 1:\n  “Hold—on,” she said… ♪ [Chorus x2]\n\tOh-oh (oh); ¿sí? — 1/2\n';
  const { context, page, errors } = await open(browser, srv, '#lyrics');
  const area = page.locator('[data-feature-host="lyrics"] textarea');
  await area.waitFor({ timeout: 20000 });
  expect((await area.inputValue()) === '', 'lyrics: a fresh editor is not empty');
  await area.fill(text);
  const stored = await page.evaluate(() =>
    localStorage.getItem('codex-prototype:host-lyrics-draft')
  );
  expect(
    stored === JSON.stringify(text),
    `lyrics: the shell stored ${stored}, not the exact text the editor reported`
  );
  await area.evaluate((el) => (el.__kept = true));
  await page.locator('[data-route="map"]').click();
  await page.locator('[data-route="lyrics"]').click();
  expect(
    await area.evaluate((el) => el.__kept === true),
    'lyrics: the editor node was replaced across a route switch'
  );
  expect(
    await headingFocused(page, 'h-lyrics'),
    'lyrics: the route change did not focus the heading'
  );
  await page.reload();
  await area.waitFor({ timeout: 20000 });
  expect(
    (await area.inputValue()) === text,
    `lyrics: after a reload the editor holds ${JSON.stringify(await area.inputValue())}`
  );
  expect(!errors.length, `lyrics: uncaught errors: ${errors.join(' | ')}`);
  await context.close();

  // A refused save is said, and the text stays in the editor.
  const refused = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await refused.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (String(k).includes('lyrics-draft')) throw new DOMException('quota', 'QuotaExceededError');
      return set.call(this, k, v);
    };
  });
  const rp = await refused.newPage();
  await rp.goto(`${srv.url}/prototype/#lyrics`);
  const ra = rp.locator('[data-feature-host="lyrics"] textarea');
  await ra.waitFor({ timeout: 20000 });
  await ra.fill('unsaved words');
  expect(/^Not saved/.test(await status(rp)), `lyrics: a refused save said "${await status(rp)}"`);
  expect(
    (await ra.inputValue()) === 'unsaved words',
    'lyrics: the text was lost when the save was refused'
  );
  await refused.close();

  const narrow = await open(browser, srv, '#lyrics', 320);
  await narrow.page.locator('[data-feature-host="lyrics"] textarea').waitFor({ timeout: 20000 });
  expect(await noSideScroll(narrow.page), 'lyrics: the page scrolls sideways at 320 px');
  await narrow.context.close();
}

async function credits(browser, srv) {
  const catalog = json('library', 'data', 'catalog.json');
  const artwork = json('library', 'data', 'artwork.json').artwork;
  const { context, page, errors } = await open(browser, srv, '#library');
  const host = page.locator('[data-feature-host="librarycredits"]');
  await host
    .locator('button', { hasText: 'Inspect all recorded availability' })
    .waitFor({ timeout: 20000 });
  const text = await host.innerText();
  const units = fmt(catalog.census.readable_reading_units);
  expect(text.includes(units), `credits: the census doesn't show ${units} readable reading units`);
  const missing = artwork.filter((a) => !text.includes(a.credit.replace(/\s+/g, ' ').trim()));
  expect(
    !missing.length,
    `credits: artwork.json credits not shown: ${missing.map((a) => a.id).join(', ')}`
  );
  await host.locator('button', { hasText: 'Inspect all recorded availability' }).click();
  await page
    .waitForFunction(
      () =>
        /Works list isn’t part of this prototype/.test(
          document.getElementById('proto-status').textContent
        ),
      null,
      { timeout: 10000 }
    )
    .catch(() => {});
  expect(
    /The full Works list isn’t part of this prototype yet/.test(await status(page)),
    `credits: Inspect all said "${await status(page)}"`
  );
  expect(!errors.length, `credits: uncaught errors: ${errors.join(' | ')}`);
  await context.close();
}

async function methods(browser, srv) {
  const registry = json('library', 'data', 'methods.json').methods;
  const { context, page, errors } = await open(browser, srv, '#library');
  const host = page.locator('[data-feature-host="librarymethods"]');
  const summary = host.locator('.lm-disclosure > summary');
  await summary.waitFor({ timeout: 20000 });
  await summary.click();
  const count = host.locator('.lm-count');
  await count.waitFor({ timeout: 10000 });
  const all = `${Math.min(registry.length, 300)} shown · ${registry.length} matching · ${registry.length} methods`;
  expect(
    (await count.textContent()) === all,
    `methods: the reference says "${await count.textContent()}", not "${all}"`
  );
  // The native predicate: name, aliases and required capabilities (#668 6641909843).
  // A query whose answer depends on aliases or capabilities, not names alone,
  // so a lane that searched names only would count differently.
  const full = (q) =>
    registry.filter((m) =>
      `${m.name} ${m.aliases?.join(' ')} ${m.required_capabilities?.join(' ')}`
        .toLowerCase()
        .includes(q)
    ).length;
  const nameOnly = (q) => registry.filter((m) => m.name.toLowerCase().includes(q)).length;
  const q = registry
    .flatMap((m) => [...(m.required_capabilities || []), ...(m.aliases || [])])
    .map((x) => String(x).toLowerCase())
    .find((x) => x && full(x) !== nameOnly(x));
  expect(!!q, 'methods: no query separates the native predicate from a names-only one');
  const hits = full(q);
  await host.locator('input[type="search"]').fill(q);
  const want = `${Math.min(hits, 300)} shown · ${hits} matching · ${registry.length} methods`;
  await page
    .waitForFunction(
      ({ w }) =>
        document.querySelector('[data-feature-host="librarymethods"] .lm-count').textContent === w,
      { w: want },
      { timeout: 5000 }
    )
    .catch(() => {});
  expect(
    (await count.textContent()) === want,
    `methods: searching "${q}" says "${await count.textContent()}", not "${want}"`
  );
  expect(!errors.length, `methods: uncaught errors: ${errors.join(' | ')}`);
  await context.close();
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
  // One tab stop for the shelf, not one per card (Jony's B1).
  const stops = await host
    .locator('.discovery-card')
    .evaluateAll((b) => b.filter((x) => x.tabIndex >= 0).length);
  expect(stops === 1, `browse: the shelf has ${stops} tab stops, not one`);
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

// Genre detail (#759) in the shell: the genre the person opens shows the
// header and Background production's gpDetail would, from the committed files.
async function genre(browser, srv) {
  const boot = new Map(json('api', 'browse_boot.json').items.map((t) => [t.id, t]));
  const prose = new Map(json('api', 'browse_prose.json').items.map((t) => [t.id, t]));
  const tree = json('data', 'tree-nodes.json');
  const pathOf = (id) => {
    const out = [];
    const seen = new Set();
    for (let p = boot.get(id).parent; p && !seen.has(p) && tree[p]; p = tree[p].p) {
      seen.add(p);
      out.unshift(tree[p].n);
    }
    return out.join(' › ');
  };
  const { context, page, errors } = await open(browser, srv, '#genre');
  const host = page.locator('[data-feature-host="genredetail"]');
  await host.getByText('No genre is open.', { exact: false }).waitFor({ timeout: 20000 });
  expect(true, 'genre: the empty state shows before a genre is opened');
  const openGenre = (id) =>
    page.evaluate(async (g) => (await import('/prototype/selection.js')).genre.set(g), id);
  for (const id of ['honky_tonk', 'bluegrass']) {
    const t = boot.get(id);
    const pr = prose.get(id) || {};
    await openGenre(id);
    await host.locator('h2', { hasText: t.name }).waitFor({ timeout: 20000 });
    const text = await host.innerText();
    const description = pr.description || t.description;
    expect(text.includes(description), `genre ${id}: the About text is not the catalog's`);
    const lineage = pr.lineage || t.lineage;
    expect(!lineage || text.includes(lineage), `genre ${id}: the Lineage is not the catalog's`);
    expect(text.includes(pathOf(id)), `genre ${id}: the classification path is not ${pathOf(id)}`);
    expect(
      !t.status || text.includes(`Catalog status: ${t.status}.`),
      `genre ${id}: the catalog status is missing`
    );
    for (const x of (pr.exemplars || t.exemplars || []).filter(
      (v) => typeof v === 'string' && v.trim()
    ))
      expect(text.includes(x), `genre ${id}: exemplar ${x} is missing`);
  }
  await page.locator('[data-route="lyrics"]').click();
  await page.locator('[data-route="genre"]').click();
  expect(
    (await host.locator('h2').textContent()) === boot.get('bluegrass').name,
    'genre: the open genre was lost across a route switch'
  );
  await openGenre('__not_a_genre__');
  await host
    .getByText('This genre isn’t in the catalog’s data. Reload to see the current catalog.')
    .waitFor({ timeout: 10000 });
  expect(true, 'genre: an unknown genre shows the shell’s sentence');
  await openGenre(null);
  await host.getByText('No genre is open.', { exact: false }).waitFor({ timeout: 10000 });
  expect(!errors.length, `genre: uncaught errors: ${errors.join(' | ')}`);
  await context.close();
  const narrow = await open(browser, srv, '#genre', 320);
  await narrow.page.evaluate(async () =>
    (await import('/prototype/selection.js')).genre.set('honky_tonk')
  );
  await narrow.page
    .locator('[data-feature-host="genredetail"] h2', { hasText: boot.get('honky_tonk').name })
    .waitFor({ timeout: 20000 });
  expect(await noSideScroll(narrow.page), 'genre: the page scrolls sideways at 320 px');
  await narrow.context.close();
}

(async () => {
  const lanes = {
    library: 'prototype/features/library/explore.js',
    browse: 'prototype/features/browse-map/discovery.js',
    lyrics: 'prototype/features/lyrics/editor.js',
    credits: 'prototype/features/library-rights/census-credits.js',
    methods: 'prototype/features/library-methods/reference.js',
    genre: 'prototype/features/genre-detail/detail.js',
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
      ['lyrics', lyrics],
      ['credits', credits],
      ['methods', methods],
      ['genre', genre],
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

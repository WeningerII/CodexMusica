#!/usr/bin/env node
'use strict';
/* global document, uiNavigate */
// A page opened straight from disk (file://) cannot fetch its data: browsers
// refuse fetch() for the file scheme. The app and the atlas used to blame the
// network ("Check your connection") and offer a Reload / Try again that can
// never succeed (#660). This opens both pages over file:// in Chromium, at a
// desktop and a phone width, and checks that each says the real cause, points
// to the hosted site and to serving the folder, and offers no retry. It also
// builds the single-file --embedded variant into an empty folder (its stated
// use: one file, no api/ beside it) and checks that the Map page there says the
// same thing in its live status instead of showing a blank frame.
//
//   node scripts/check_file_protocol_browser.js
//
// CHROMIUM_PATH may name a Chromium executable.
const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const PAGES = [
  { file: 'codex.html', message: '#boot-error', retry: '#boot-error button' },
  { file: 'atlas.html', message: '#loading', retry: '#loading button' },
];
const WIDTHS = [1280, 375];
const NAMES_CAUSE = (text, expect, at) => {
  expect(
    !/check your connection|reach the server/i.test(text),
    `${at}: still blames the network: "${text}"`
  );
  expect(
    /opened from a file/i.test(text),
    `${at}: does not name the cause (opened from a file): "${text}"`
  );
  expect(/codexmusica\.com/.test(text), `${at}: does not point to the hosted site`);
  expect(/python3 -m http\.server/.test(text), `${at}: does not say how to serve the folder`);
};

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  const problems = [];
  let checks = 0;
  const expect = (ok, what) => {
    checks++;
    if (!ok) problems.push(what);
  };
  try {
    for (const p of PAGES) {
      for (const width of WIDTHS) {
        const page = await browser.newPage({ viewport: { width, height: 800 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        const at = `${p.file} @${width}`;
        await page.goto(pathToFileURL(path.join(root, p.file)).href);
        await page
          .waitForFunction(
            (sel) => {
              const el = document.querySelector(sel);
              return el && /did not load|Couldn|Open this page/.test(el.textContent);
            },
            p.message,
            { timeout: 20000 }
          )
          .catch(() => {});
        const seen = await page.evaluate(({ message, retry }) => {
          const el = document.querySelector(message);
          return {
            text: el ? el.textContent.replace(/\s+/g, ' ').trim() : '',
            retries: [...document.querySelectorAll(retry)].map((b) => b.textContent.trim()),
            announced: !!(
              el &&
              (el.closest('[role=alert],[role=status]') || el.getAttribute('aria-live'))
            ),
          };
        }, p);
        expect(seen.text !== '', `${at}: no failure message rendered`);
        NAMES_CAUSE(seen.text, expect, at);
        expect(
          seen.retries.length === 0,
          `${at}: offers a retry that cannot work: ${seen.retries.join(', ')}`
        );
        expect(seen.announced, `${at}: the message is not in a live region`);
        expect(errors.length === 0, `${at}: page errors: ${errors.join(' | ')}`);
        await page.close();
      }
    }
    // The standalone embedded build's Map page.
    const alone = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-embedded-'));
    const embedded = path.join(alone, 'codex.html');
    try {
      execFileSync(
        process.execPath,
        [path.join(root, 'scripts/build_html.js'), '--embedded', '--quiet', `--out=${embedded}`],
        { cwd: root, stdio: 'ignore' }
      );
      for (const width of WIDTHS) {
        const page = await browser.newPage({ viewport: { width, height: 800 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        const at = `embedded Map @${width}`;
        await page.goto(pathToFileURL(embedded).href);
        await page.waitForFunction(() => typeof uiNavigate === 'function', null, {
          timeout: 30000,
        });
        await page.evaluate(() => uiNavigate('map'));
        await page.waitForTimeout(1500);
        const seen = await page.evaluate(() => {
          const st = document.getElementById('map-status');
          const fr = document.getElementById('map-frame');
          const r = st && st.getBoundingClientRect();
          return {
            text: st && !st.hidden ? st.textContent.replace(/\s+/g, ' ').trim() : '',
            role: st && st.getAttribute('role'),
            frameShown: !!(fr && !fr.hidden && fr.getAttribute('src')),
            fits: !!(r && r.left >= 0 && r.right <= document.documentElement.clientWidth),
          };
        });
        expect(seen.text !== '', `${at}: no message where the map would be`);
        NAMES_CAUSE(seen.text, expect, at);
        expect(seen.role === 'status', `${at}: the message is not announced (role=${seen.role})`);
        expect(!seen.frameShown, `${at}: the map frame is still loaded (a blank frame)`);
        expect(seen.fits, `${at}: the message runs off the page`);
        expect(errors.length === 0, `${at}: page errors: ${errors.join(' | ')}`);
        await page.close();
      }
    } finally {
      fs.rmSync(alone, { recursive: true, force: true });
    }
  } finally {
    await browser.close();
  }
  if (problems.length) {
    console.log(`FILE PROTOCOL: FAIL — ${problems.length} of ${checks} checks`);
    for (const p of problems) console.log(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log(
    `FILE PROTOCOL: PASS — ${checks} checks: codex.html, atlas.html and the standalone embedded Map opened from disk, at ${WIDTHS.join(' and ')} px, name the cause, point to the hosted site and to serving the folder, and offer no retry`
  );
})();

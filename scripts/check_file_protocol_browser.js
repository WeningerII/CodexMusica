#!/usr/bin/env node
'use strict';
/* global document */
// A page opened straight from disk (file://) cannot fetch its data: browsers
// refuse fetch() for the file scheme. The app and the atlas used to blame the
// network ("Check your connection") and offer a Reload / Try again that can
// never succeed (#660). This opens both pages over file:// in Chromium, at a
// desktop and a phone width, and checks that each says the real cause, points
// to the hosted site and to serving the folder, and offers no retry.
//
//   node scripts/check_file_protocol_browser.js
//
// CHROMIUM_PATH may name a Chromium executable.
const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const PAGES = [
  { file: 'codex.html', message: '#boot-error', retry: '#boot-error button' },
  { file: 'atlas.html', message: '#loading', retry: '#loading button' },
];
const WIDTHS = [1280, 375];

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
        expect(
          !/check your connection|reach the server/i.test(seen.text),
          `${at}: still blames the network: "${seen.text}"`
        );
        expect(
          /opened from a file/i.test(seen.text),
          `${at}: does not name the cause (opened from a file): "${seen.text}"`
        );
        expect(/codexmusica\.com/.test(seen.text), `${at}: does not point to the hosted site`);
        expect(
          /python3 -m http\.server/.test(seen.text),
          `${at}: does not say how to serve the folder`
        );
        expect(
          seen.retries.length === 0,
          `${at}: offers a retry that cannot work: ${seen.retries.join(', ')}`
        );
        expect(seen.announced, `${at}: the message is not in a live region`);
        expect(errors.length === 0, `${at}: page errors: ${errors.join(' | ')}`);
        await page.close();
      }
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
    `FILE PROTOCOL: PASS — ${checks} checks: codex.html and atlas.html opened from disk, at ${WIDTHS.join(' and ')} px, name the cause, point to the hosted site and to serving the folder, and offer no retry`
  );
})();

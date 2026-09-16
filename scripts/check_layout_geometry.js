#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const dom = new JSDOM(
  '<button id="trigger">Open</button><div id="popup">Results</div><aside id="panel"><header>Panel</header></aside>',
  { url: 'https://codexmusica.com', runScripts: 'dangerously', pretendToBeVisual: true }
);
const w = dom.window,
  doc = w.document;
w.innerWidth = 360;
w.innerHeight = 740;
const rect = (x, y, width, height) => ({
  x,
  y,
  left: x,
  top: y,
  right: x + width,
  bottom: y + height,
  width,
  height,
});
w.HTMLElement.prototype.getClientRects = function () {
  return this.hidden ? [] : [this.getBoundingClientRect()];
};
const layout = w.eval(
  fs.readFileSync(path.join(__dirname, '../src/layout.js'), 'utf8') + '\nUILayout;'
);
const trigger = doc.getElementById('trigger'),
  popup = doc.getElementById('popup');
let anchor = rect(2, 680, 210, 40);
trigger.getBoundingClientRect = () => anchor;
Object.defineProperty(popup, 'scrollHeight', { get: () => 900 });
popup.getBoundingClientRect = () =>
  rect(
    parseFloat(popup.style.left) || 0,
    parseFloat(popup.style.top) || 0,
    Math.min(420, parseFloat(popup.style.maxWidth) || 420),
    Math.min(600, parseFloat(popup.style.maxHeight) || 600)
  );
const stop = layout.anchor(popup, trigger);
assert.equal(popup.style.left, '8px', 'a popup wider than its anchor stays on screen');
assert.equal(popup.style.top, '74px', 'bottom-edge popup flips above the anchor');
assert.equal(popup.getBoundingClientRect().right, 352);
stop();
anchor = rect(300, 24, 40, 30);
layout.anchor(popup, trigger, { align: 'end' });
assert.equal(popup.style.left, '8px');
assert.equal(popup.style.top, '60px');
const panel = doc.getElementById('panel');
w.innerWidth = 1200;
w.innerHeight = 900;
panel.getBoundingClientRect = () =>
  panel.classList.contains('layout-adjusted')
    ? rect(
        ...['x', 'y', 'width', 'height'].map((k) =>
          parseFloat(panel.style.getPropertyValue('--panel-' + k))
        )
      )
    : rect(700, 70, 480, 700);
layout.floating(panel, { key: 'test', title: 'test panel', header: 'header' });
const key = (label, value) =>
  panel
    .querySelector('[aria-label="' + label + '"]')
    .dispatchEvent(new w.KeyboardEvent('keydown', { key: value, bubbles: true }));
key('Move test panel', 'ArrowRight');
assert.equal(panel.getBoundingClientRect().x, 710);
for (let n = 0; n < 30; n++) key('Move test panel', 'ArrowRight');
assert.equal(panel.getBoundingClientRect().right, 1192, 'moving clamps at the right edge');
key('Resize test panel', 'ArrowLeft');
assert.equal(panel.getBoundingClientRect().width, 470);
key('Move test panel', 'Home');
assert.equal(panel.classList.contains('layout-adjusted'), false, 'reset restores responsive CSS');
assert.equal(w.localStorage.getItem('codex-layout:test'), null);
// Saving geometry does not save opaque interaction snapshots or recipe state.
key('Move test panel', 'ArrowLeft');
assert.deepEqual(Object.keys(JSON.parse(w.localStorage.getItem('codex-layout:test'))).sort(), [
  'height',
  'width',
  'x',
  'y',
]);
layout.reset();
assert.equal(panel.classList.contains('layout-adjusted'), false);
dom.window.close();
console.log(
  'PASS layout geometry: edge clamping, upward opening, keyboard move/resize, bounded preferences, reset'
);

#!/usr/bin/env node
'use strict';
/* global document, Catalog, TREE_NODES, tradParent, getChildren, countDescendantLeaves, renderTradPicker, CODEX_LAZY_API */
// The Browse tree's index (#663 A1) answers exactly as the filter it replaced,
// on every path that sets the catalog: the boot index, then a replacement of
// the catalog list that keeps its length (only the list's identity changes)
// and one that shortens it. The reference below is the pre-index algorithm,
// verbatim, evaluated on the same page state.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + req.url.split('?')[0]);
  if (
    !file.startsWith(root + path.sep) ||
    !fs.existsSync(file) ||
    fs.statSync(file).isDirectory()
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader(
    'Content-Type',
    file.endsWith('.html')
      ? 'text/html'
      : file.endsWith('.json')
        ? 'application/json'
        : 'application/javascript'
  );
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
  let checks = 0;
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/codex.html#genre`);
    await page.waitForFunction(
      () => typeof Catalog !== 'undefined' && Catalog.all().length > 1000,
      null,
      {
        timeout: 60000,
      }
    );
    const result = await page.evaluate(async () => {
      // The pre-index algorithm (main before #663 A1), unchanged.
      const refChildren = (id) => [
        ...TREE_NODES.filter((n) => n.parent === id),
        ...Catalog.all().filter((t) => tradParent(t.id) === id),
      ];
      const refCount = (id) => {
        let count = 0;
        const stack = [id];
        while (stack.length)
          refChildren(stack.pop()).forEach((k) => {
            if (TREE_NODES.some((n) => n.id === k.id)) stack.push(k.id);
            else count++;
          });
        return count;
      };
      const ids = [null, ...TREE_NODES.map((n) => n.id)];
      const diff = (label) => {
        const bad = [];
        for (const id of ids) {
          const got = getChildren(id)
            .map((c) => c.id)
            .join(',');
          const want = refChildren(id)
            .map((c) => c.id)
            .join(',');
          if (got !== want) bad.push(`${label} children ${id}`);
          if (id !== null && countDescendantLeaves(id) !== refCount(id))
            bad.push(`${label} count ${id}`);
        }
        return bad;
      };
      const out = { nodes: ids.length, bad: [] };
      const html = () => document.getElementById('picker-trad')?.innerHTML || '';
      renderTradPicker();
      const first = html();
      out.bad.push(...diff('boot'));
      const boot = await (await fetch(CODEX_LAZY_API + 'browse_boot.json')).json();
      const inner = new Set(TREE_NODES.map((n) => n.id));
      // Same length, new list: move one genre to another tree node and swap two
      // genres' order. Only the list's identity tells the index to rebuild.
      const same = structuredClone(boot);
      const i = same.items.findIndex((t) => inner.has(t.parent));
      const moved = same.items[i].id,
        from = same.items[i].parent;
      const to = TREE_NODES.find(
        (n) => n.id !== from && Catalog.all().some((t) => tradParent(t.id) === n.id)
      ).id;
      same.items[i].parent = to;
      [same.items[0], same.items[1]] = [same.items[1], same.items[0]];
      Catalog.bootFromIndex(same, CODEX_LAZY_API);
      renderTradPicker();
      out.bad.push(...diff('same-length'));
      out.moved =
        getChildren(to).some((c) => c.id === moved) &&
        !getChildren(from).some((c) => c.id === moved);
      // Shorter list.
      const fewer = structuredClone(boot);
      fewer.items.splice(
        fewer.items.findIndex((t) => t.id === moved),
        1
      );
      Catalog.bootFromIndex(fewer, CODEX_LAZY_API);
      renderTradPicker();
      out.bad.push(...diff('shorter'));
      // Back to the published index: the picker matches its first render.
      Catalog.bootFromIndex(boot, CODEX_LAZY_API);
      renderTradPicker();
      out.bad.push(...diff('restored'));
      out.html = first.length;
      out.same = html() === first;
      return out;
    });
    assert.ok(result.nodes > 300, `expected the whole tree, got ${result.nodes} nodes`);
    checks++;
    assert.deepEqual(result.bad, [], 'index differs from the pre-index algorithm');
    checks++;
    assert.ok(result.moved, 'a re-parented genre moved in the rebuilt index');
    checks++;
    assert.ok(result.html > 0, 'the picker rendered');
    checks++;
    assert.ok(
      result.same,
      'the picker after restoring the published index equals its first render'
    );
    checks++;
    console.log(
      `PASS: ${checks} Browse-tree index checks across ${result.nodes} nodes and 4 catalog states`
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

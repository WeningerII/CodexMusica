#!/usr/bin/env node
'use strict';
// check_locale_invariance.js — the rendered recipe must not depend on the
// machine's locale.
//
// WHY THIS EXISTS. Recipe ordering once came from `localeCompare` with no locale
// argument, which collates by the runtime's default ICU locale. The same catalog
// therefore rendered differently for a Danish reader than for the build machine:
// da-DK reads "aa" as "å", so "maag" sorts after "mid-emphasized" and a
// descriptor chunk comes out reordered. The fix was `_cmp`, a codepoint
// comparator, copied into six files because the app is inlined into codex.html
// and cannot require a module.
//
// What guarded that fix afterwards was a pair of source comments claiming
// check_app_parity.js would go red on a regression. It does not, and the gap is
// structural rather than an oversight:
//
//   - check_app_parity renders BOTH engines in ONE process under ONE locale, so
//     it can only see a comparator change that makes the two DISAGREE. Regress
//     one copy and it catches it; regress both together and both are equally
//     wrong, so it passes. Verified both ways.
//   - The pinned fixtures (regression_recipes, app_recipe_regression) are
//     compared against snapshots generated under the runner's own locale, and
//     the pin was deliberately chosen to be output-neutral under en-US. So they
//     agree with a locale-dependent comparator too, as long as CI keeps running
//     en-US. Verified: 1149/1149 still pass with the comparator reverted.
//
// Both blind spots have the same root — every existing check observes ONE
// locale, and "output does not depend on locale" is a statement about two. So
// this gate renders the catalog in two child processes under deliberately
// different collations and compares the bytes. A comparator that consults the
// host locale produces different output in the two children, whether one copy
// drifted or both drifted together, and whether or not any fixture happens to
// cover an affected descriptor set.
//
// ESLint's no-restricted-syntax ban on bare localeCompare covers the common
// spelling cheaply, on every lint. This covers the rest of the class: an
// explicit-but-host-sensitive locale, a stray Intl.Collator, a sort() that picks
// up collation some other way.
//
// Usage:
//   node scripts/check_locale_invariance.js
//   node scripts/check_locale_invariance.js --limit=400   # faster sample
// Exit 0 if the two locales render identically, 1 otherwise.

const { execFileSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const flag = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
};
const LIMIT = parseInt(flag('limit', '0'), 10); // 0 = whole catalog

// The two collations. da-DK is the locale the original bug shipped under; C is
// byte order. If a comparator consults the host locale at all, these disagree.
const LOCALES = [
  { label: 'da-DK', env: { LANG: 'da_DK.UTF-8', LC_ALL: 'da_DK.UTF-8' } },
  { label: 'C', env: { LANG: 'C', LC_ALL: 'C' } },
];

// The child renders and prints per-tradition digests. It runs BOTH renderers —
// the Node engine and the browser app's own compileRecipeStack — because they
// carry separate _cmp copies and a regression in either is the bug.
const CHILD = `
const C = require(${JSON.stringify(path.join(__dirname, '_loader.js'))});
const { loadApp } = require(${JSON.stringify(path.join(__dirname, '_load_app.js'))});
const { seedTraditionCards, renderWorkspace } = require(${JSON.stringify(path.join(__dirname, '_seed_workspace.js'))});
const crypto = require('crypto');
const LIMIT = ${LIMIT};
const app = loadApp();
const FORMATS = ['rich', 'tags', 'prose', 'compact'];
let ids = (C.TRADITIONS || []).map((t) => t.id);
if (LIMIT > 0) ids = ids.slice(0, LIMIT);
const h = crypto.createHash('sha256');
let n = 0;
for (const id of ids) {
  for (const f of FORMATS) {
    h.update(renderWorkspace(seedTraditionCards(id), { format: f, ceiling: 1000 }));
    n++;
  }
  app.app.cards = [];
  app.app.collapsedTraditionGroups = new Set();
  app.importTradition(id);
  for (const f of FORMATS) {
    h.update(app.compileRecipeStack(app.app.cards, f, { ceiling: 1000 }));
    n++;
  }
}
process.stdout.write(JSON.stringify({
  locale: Intl.DateTimeFormat().resolvedOptions().locale,
  renders: n,
  digest: h.digest('hex'),
}));
`;

function runUnder(locale) {
  const out = execFileSync(process.execPath, ['-e', CHILD], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...locale.env },
  });
  return JSON.parse(out);
}

console.log('=== Locale invariance: the rendered recipe must not depend on the machine ===');
const results = [];
for (const loc of LOCALES) {
  const t0 = Date.now();
  const r = runUnder(loc);
  results.push({ ...r, label: loc.label, ms: Date.now() - t0 });
  console.log(
    `  ${loc.label.padEnd(6)} resolved=${String(r.locale).padEnd(8)} renders=${r.renders}  digest=${r.digest.slice(0, 16)}…  (${Date.now() - t0}ms)`
  );
}

// Refuse to pass vacuously: identical digests over zero renders prove nothing,
// and a child that silently rendered nothing would otherwise mint a green
// result. Same guard check_app_parity.js applies to an empty catalog.
if (!results.length || results.some((r) => !r.renders)) {
  console.error(
    '\nLOCALE INVARIANCE: FAIL — a child rendered nothing; refusing to pass vacuously.'
  );
  process.exit(1);
}

// The two children must also have genuinely resolved different collations,
// otherwise this is one locale tested twice. A runner without da-DK ICU data
// would fall back and quietly make the comparison meaningless.
if (results[0].locale === results[1].locale) {
  console.error(
    `\nLOCALE INVARIANCE: FAIL — both children resolved to ${results[0].locale}; the ICU data for the second locale is missing, so this compared one locale with itself.`
  );
  process.exit(1);
}

const [a, b] = results;
if (a.digest !== b.digest) {
  console.error(
    `\nLOCALE INVARIANCE: FAIL — ${a.label} and ${b.label} render different bytes.\n` +
      `  Something on the render path is consulting the host locale. The comparator that\n` +
      `  reaches a recipe must be _cmp (codepoint); see the note above its definition in\n` +
      `  scripts/_recipe_stack.js and src/app.js.`
  );
  process.exit(1);
}
console.log(
  `\nLOCALE INVARIANCE: PASS — ${a.renders} renders are byte-identical under ${a.label} and ${b.label}.`
);
process.exit(0);

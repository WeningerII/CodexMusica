#!/usr/bin/env node
// check_minified_equivalence.js — the minified app IS the app it was built from.
//
// @covers: minified-equivalence
//
// WHY THIS EXISTS, and it is not the bug that prompted it. Since 2026-09-14 the
// shipped page is minified: every byte of src/app.js and of the nine catalog
// tables is parsed by terser and reprinted. That is a semantic transformation
// over the whole application, and on the day it landed NOTHING compared its
// output against the source it came from. The three behavioural harnesses that
// look like they would — check_workbench, check_lazy_app, equivalence — all
// invoke build_html.js with default flags, which means all three build the
// MINIFIED page and validate it against itself. `--no-minify` existed and no
// gate used it. So the guarantee "minifying changed nothing" rested on terser
// being correct and on nobody changing its options, neither of which is checked.
//
// The failure that prompted this was caught by those harnesses only because it
// was total: a lost newline commented out the entire application and `UI` never
// appeared. A SUBTLER transformation bug — one table reprinted with a different
// numeric literal, one string escape normalized wrongly, one option quietly
// enabled that renames a cross-block global — would leave a page that boots,
// renders, and is wrong. That is the class this gate closes, and it is the same
// class as the two failures that actually cost this repo time: a nightly-only
// instrument drifting behind a green tree, and a gate printing PASS while
// checking nothing. Unverified, not broken.
//
// WHAT IT PROVES. Both builds come from the SAME source in the same run and
// differ only in whether squeeze() ran. Booted side by side in jsdom, they must
// agree on:
//
//   • Catalog projection — every tradition's app-facing fields, across all ids.
//     Catches a data table reprinted with any value changed.
//   • Rendered browse surfaces — renderTradPicker() innerHTML, string-equal,
//     for the tree and for four queries. Catches a render path or the search
//     index diverging.
//   • Import and the recipe string — a cross-family sample imported and
//     rendered in every format. Catches the engine diverging.
//   • Preface suggestion — the matcher that decides which named signature a
//     word resolves to.
//
// WHY --embedded FOR BOTH: it makes each build self-contained, so this gate
// compares minification against minification alone and needs no fetch shim.
// check_lazy_app.js separately proves the lazy shell equals the embedded build.
//
// USAGE
//   node scripts/check_minified_equivalence.js            # build both, compare
//   node scripts/check_minified_equivalence.js --verbose  # per-check detail

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

const VERBOSE = process.argv.includes('--verbose');
const problems = [];
const fail = (msg) => problems.push(msg);
const note = (msg) => {
  if (VERBOSE) console.error('  ' + msg);
};

// Cross-family sample, matching check_lazy_app.js: umbrella genre, guitar-amp
// chain, acoustic/voice, electronic, non-12-TET tuning, field polyphony.
const IMPORT_SAMPLE = [
  'pop',
  'death_metal',
  'delta_blues',
  'detroit_techno',
  'hindustani',
  'aka_baka_polyphony',
];
const SEARCH_QUERIES = ['', 'pop', 'metal', 'lo-fi'];
const PREFACE_QUERIES = ['warm', 'bright', 'worn'];

function buildTempHtml(minified) {
  const tmp = path.join(os.tmpdir(), `codex_min_${minified ? 'on' : 'off'}_${process.pid}.html`);
  const args = [path.join(__dirname, 'build_html.js'), `--out=${tmp}`, '--quiet', '--embedded'];
  // The control build is the ONLY thing here that opts out. If this flag ever
  // stops disabling minification, both sides become the minified page and this
  // gate silently compares it against itself — the exact defect it exists to
  // end. The assertion below (the two builds must differ in size) is what makes
  // that impossible to miss.
  if (!minified) args.push('--no-minify');
  execFileSync('node', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  const html = fs.readFileSync(tmp, 'utf8');
  fs.unlinkSync(tmp);
  return html;
}

function bootDom(html) {
  return new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.storage = {
        async get() {
          return null;
        },
        async set() {},
        async delete() {},
        async list() {
          return { keys: [] };
        },
      };
      w.matchMedia = () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      });
      w.scrollTo = () => {};
      // Embedded builds need no network; anything reaching for one is a bug.
      w.fetch = () => Promise.reject(new Error('embedded build must not fetch'));
    },
  });
}

function runProbe(dom, probeBody, timeoutMs = 30000) {
  const s = dom.window.document.createElement('script');
  s.textContent = `(async () => {
    try {
      if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, {once:true}));
      if (typeof CATALOG_READY !== 'undefined' && CATALOG_READY) await CATALOG_READY;
      if (typeof UI !== 'undefined') {
        for (let i=0;i<200&&!UI.ready;i++) await new Promise(r=>setTimeout(r,10));
        if (!UI.ready) throw Error('Workbench did not finish booting');
      }
      window.__probe = await (async () => { ${probeBody} })();
    } catch (e) { window.__probe = { __err: String((e && e.stack) || e) }; }
  })();`;
  dom.window.document.body.appendChild(s);
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const poll = setInterval(() => {
      if (dom.window.__probe !== undefined) {
        clearInterval(poll);
        resolve(dom.window.__probe);
      } else if (Date.now() - t0 > timeoutMs) {
        clearInterval(poll);
        reject(new Error('probe timed out'));
      }
    }, 50);
  });
}

const CAPTURE_PROBE = `
  const sample = ${JSON.stringify(IMPORT_SAMPLE)};
  const queries = ${JSON.stringify(SEARCH_QUERIES)};
  const prefaceQueries = ${JSON.stringify(PREFACE_QUERIES)};
  const out = { catalog: {}, pickers: {}, cards: null, recipes: {}, prefaces: {}, counts: {} };

  for (const t of Catalog.all()) {
    const ext = Catalog.ext(t.id) || {};
    out.catalog[t.id] = {
      name: t.name, family: t.family,
      lineage: t.lineage || null,
      instruments: t.instruments || [],
      parent: ext.parent || null,
      axes: ext.axes || {},
      description: ext.description || '',
      exemplars: ext.exemplars || [],
      crossRefs: ext.crossRefs || [],
    };
  }
  out.counts = {
    traditions: Catalog.all().length,
    instruments: typeof INSTRUMENTS !== 'undefined' ? INSTRUMENTS.length : -1,
    rooms: typeof ROOMS !== 'undefined' ? ROOMS.length : -1,
    tunings: typeof TUNINGS !== 'undefined' ? TUNINGS.length : -1,
    prefaces: typeof PREFACE_LEXICON !== 'undefined' ? PREFACE_LEXICON.length : -1,
  };

  const picker = document.getElementById('picker-trad');
  for (const q of queries) {
    app.similarFor = null;
    app.tradSearch = q;
    renderTradPicker();
    out.pickers[q || '(tree)'] = picker ? picker.innerHTML : '(no picker element)';
  }

  for (const id of sample) {
    await Catalog.ensureFull(id);
    importTradition(id);
  }
  out.cards = app.cards.map((c) => ({
    instrumentId: c.instrumentId, traditionId: c.traditionId || null,
    tuning: c.tuning || null, room: c.room || null,
    parts: c.parts || null, chain: c.chain || null,
  }));
  // Every format, because each takes a different path through the stack
  // compiler and a transformation could break one and not the others.
  for (const f of ['rich', 'tags', 'prose', 'compact']) {
    out.recipes[f] = compileRecipeStack(app.cards, f, { ceiling: 1000 });
  }

  // The preface matcher decides which named signature a word resolves to; it
  // reads the lexicon table, so a reprinted table shows up here.
  for (const q of prefaceQueries) {
    app.prefaceSearch = q;
    renderPrefaceModalBody();
    const body = document.getElementById('preface-modal-body');
    out.prefaces[q] = body
      ? [...body.querySelectorAll('.preface-pick')].map((b) => b.dataset.prefId).join(',')
      : '(no preface body)';
  }
  return out;
`;

function compare(label, a, b) {
  const sa = typeof a === 'string' ? a : JSON.stringify(a);
  const sb = typeof b === 'string' ? b : JSON.stringify(b);
  if (sa === sb) {
    note(`✓ ${label}`);
    return true;
  }
  // Point at the first divergence rather than printing two megabyte blobs.
  let i = 0;
  while (i < sa.length && i < sb.length && sa[i] === sb[i]) i++;
  fail(
    `${label} differs at offset ${i}:\n` +
      `      unminified: …${sa.slice(Math.max(0, i - 40), i + 60)}…\n` +
      `      minified:   …${sb.slice(Math.max(0, i - 40), i + 60)}…`
  );
  return false;
}

(async () => {
  console.error('Building the embedded app twice — unminified and minified…');
  const plain = buildTempHtml(false);
  const min = buildTempHtml(true);
  note(
    `unminified ${(plain.length / 1e6).toFixed(2)} MB, minified ${(min.length / 1e6).toFixed(2)} MB`
  );

  // THE CONTROL CHECK. If these are the same size, `--no-minify` stopped
  // opting out and every comparison below is the minified page against itself,
  // which would pass forever while proving nothing.
  if (plain.length <= min.length) {
    fail(
      `the control build is not smaller than the minified one ` +
        `(${plain.length} vs ${min.length}) — --no-minify is no longer opting out, ` +
        `so this gate would be comparing the minified page against itself`
    );
  } else {
    note(
      `control is ${(((plain.length - min.length) / plain.length) * 100).toFixed(1)}% larger — --no-minify is opting out`
    );
  }

  const plainDom = bootDom(plain);
  const minDom = bootDom(min);
  const [a, b] = await Promise.all([
    runProbe(plainDom, CAPTURE_PROBE),
    runProbe(minDom, CAPTURE_PROBE),
  ]);
  if (a.__err) fail('unminified probe crashed: ' + a.__err);
  if (b.__err) fail('minified probe crashed: ' + b.__err);

  if (!a.__err && !b.__err) {
    compare('catalog projection (all traditions)', a.catalog, b.catalog);
    compare('table sizes', a.counts, b.counts);
    for (const q of Object.keys(a.pickers)) {
      compare(
        `renderTradPicker innerHTML — ${q === '(tree)' ? 'full tree' : `"${q}"`}`,
        a.pickers[q],
        b.pickers[q]
      );
    }
    compare(`imported cards (${IMPORT_SAMPLE.length} traditions)`, a.cards, b.cards);
    for (const f of Object.keys(a.recipes))
      compare(`recipe string — ${f}`, a.recipes[f], b.recipes[f]);
    for (const q of Object.keys(a.prefaces))
      compare(`preface matches — "${q}"`, a.prefaces[q], b.prefaces[q]);
    note(`compared ${Object.keys(a.catalog).length} traditions and ${a.counts.prefaces} prefaces`);
  }

  if (problems.length) {
    console.error(`\nMINIFIED EQUIVALENCE: FAIL — ${problems.length} difference(s):`);
    for (const p of problems) console.error('  ✗ ' + p);
    console.error(
      '\nThe minified page does not behave like the source it was built from.\n' +
        'Minification is meant to change bytes and nothing else, so a difference here\n' +
        'is a transformation bug — check scripts/_minify.js OPTIONS and the pinned\n' +
        'terser version before assuming the app changed.'
    );
    process.exit(1);
  }
  console.error(
    `\nMINIFIED EQUIVALENCE: PASS — the minified app matches the unminified one across ` +
      `${Object.keys(a.catalog).length} traditions, ${Object.keys(a.pickers).length} rendered surfaces, ` +
      `${IMPORT_SAMPLE.length} imports, 4 recipe formats and ${PREFACE_QUERIES.length} preface queries.`
  );
})().catch((e) => {
  console.error('check_minified_equivalence failed:', (e && e.stack) || e);
  process.exit(1);
});

#!/usr/bin/env node
// equivalence.js — BEHAVIORAL parity between the browser app and the node path.
//
// @covers: browser-node-parity
//
// WHY THIS EXISTS: the codex ships the same core logic twice — once inlined in
// src/app.js (the browser, codex.html) and once in scripts/ primitives (the
// agent/CLI path). tandem.js already guards these pairs, but only TEXTUALLY: it
// greps the two sources for matching invariant patterns. A textual check
// verifies the code LOOKS aligned; it cannot catch the two implementations
// producing DIFFERENT OUTPUT on the same input. That gap is exactly the class
// of drift that shipped a forked tradition-signature set (browser and CLI
// disagreed while every textual check still passed).
//
// This test closes the gap: it executes the BROWSER's real functions (in jsdom,
// from the freshly-built codex.html) and the NODE primitives on the SAME card
// fixtures, then asserts the outputs are identical. Behavioral, not textual.
//
// PAIRS CHECKED (same input → must match):
//   1. card descriptor set : browser _cardDescriptorSet(card)  ==  node _card_descriptors.cardDescriptors(card, C, sigs)
//   2. preface suggestion   : browser suggestPrefaceForCard(card) == node _preface_match.suggest(descs, lexicon)
//
// Both consume the catalog tables and the tradition-signatures map; agreement
// here means a recipe/preface decision is the same whether a human used the app
// or an agent used the CLI. Divergence fails loudly with the disagreeing cards.
//
// USAGE
//   node scripts/equivalence.js            # assert browser == node on the sample
//   node scripts/equivalence.js --verbose  # print every card's compared values

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

const C = require('./_loader.js');
const { cardDescriptors } = require('./_card_descriptors.js');
const prefaceMatch = require('./_preface_match.js');

const SIGS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'references/_tradition_signatures.json'), 'utf8')
);
const VERBOSE = process.argv.includes('--verbose');

// Fixture sample — spans families and tradition-bearing vs bare cards so the
// signature path (only active when traditionId is set) is exercised on both
// sides. Keyed by id so catalog growth doesn't shift the sample.
const FIXTURES = [
  { instrumentId: 'voice', traditionId: 'delta_blues' },
  { instrumentId: 'electric_guitar_single_coil', traditionId: 'outlaw_country' },
  { instrumentId: 'saxophone', traditionId: 'bebop' },
  { instrumentId: 'tabla', traditionId: 'hindustani' },
  { instrumentId: 'drum_machine_909', traditionId: 'detroit_techno' },
  { instrumentId: 'oud', traditionId: null },
  { instrumentId: 'grand_piano', traditionId: null },
  { instrumentId: 'congas', traditionId: 'palm_wine' },
];

function buildTempHtml() {
  const tmp = path.join(os.tmpdir(), `codex_equiv_${process.pid}.html`);
  // --embedded: this harness boots the page in jsdom with NO fetch — it needs
  // the tradition tables in the page. check_lazy_app.js proves the shipped
  // lazy shell behaves identically to this embedded build.
  execFileSync(
    'node',
    [path.join(__dirname, 'build_html.js'), `--out=${tmp}`, '--quiet', '--embedded'],
    {
      stdio: ['ignore', 'ignore', 'inherit'],
    }
  );
  return tmp;
}

// Boot codex.html in jsdom and, for each fixture, build the card with the
// browser's OWN makeCard, then return the browser-computed descriptor set
// (sorted array) and the browser-suggested preface id.
function browserResults(html) {
  return new Promise((resolve) => {
    const dom = new JSDOM(html, {
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
      },
    });
    setTimeout(() => {
      const probe = `(function(){
        const fixtures = ${JSON.stringify(FIXTURES)};
        const out = {};
        for (const fx of fixtures) {
          const key = fx.instrumentId + '@' + (fx.traditionId || '(none)');
          try {
            // Build the card the browser's own way, then force the exact
            // traditionId (makeCard doesn't set it from opts in all paths).
            const card = makeCard(fx.instrumentId, { traditionId: fx.traditionId });
            if (!card) { out[key] = { err: 'null-card' }; continue; }
            card.traditionId = fx.traditionId;
            const descs = Array.from(_cardDescriptorSet(card)).sort();
            const preface = suggestPrefaceForCard(card);
            out[key] = { descs, preface, parts: card.parts, tuning: card.tuning, room: card.room };
          } catch (e) { out[key] = { err: String(e && e.message) }; }
        }
        window.__equiv = out;
      })();`;
      const s = dom.window.document.createElement('script');
      s.textContent = probe;
      dom.window.document.body.appendChild(s);
      const out = dom.window.__equiv || {};
      dom.window.close();
      resolve(out);
    }, 1500);
  });
}

// Compute the node-side equivalents from the SAME card state the browser used
// (parts/tuning/room captured from the browser card, so we compare the logic,
// not divergent card construction).
function nodeResults(browser) {
  const out = {};
  for (const fx of FIXTURES) {
    const key = fx.instrumentId + '@' + (fx.traditionId || '(none)');
    const b = browser[key];
    if (!b || b.err) {
      out[key] = { err: b ? b.err : 'no-browser-card' };
      continue;
    }
    const card = {
      instrumentId: fx.instrumentId,
      traditionId: fx.traditionId,
      parts: b.parts,
      tuning: b.tuning,
      room: b.room,
      chain: {},
    };
    const set = cardDescriptors(card, C, SIGS);
    const descs = Array.from(set).sort();
    const preface = prefaceMatch.suggest(set, C.PREFACE_LEXICON);
    out[key] = { descs, preface };
  }
  return out;
}

(async () => {
  const tmp = buildTempHtml();
  const html = fs.readFileSync(tmp, 'utf8');
  fs.unlinkSync(tmp);

  const browser = await browserResults(html);
  const node = nodeResults(browser);

  const mismatches = [];
  for (const fx of FIXTURES) {
    const key = fx.instrumentId + '@' + (fx.traditionId || '(none)');
    const b = browser[key],
      n = node[key];
    if (!b || b.err) {
      mismatches.push(`${key}: browser error — ${b ? b.err : 'missing'}`);
      continue;
    }
    if (!n || n.err) {
      mismatches.push(`${key}: node error — ${n ? n.err : 'missing'}`);
      continue;
    }

    const descsB = JSON.stringify(b.descs);
    const descsN = JSON.stringify(n.descs);
    if (descsB !== descsN) {
      // Report the symmetric difference so a drift is actionable.
      const setB = new Set(b.descs),
        setN = new Set(n.descs);
      const onlyB = b.descs.filter((d) => !setN.has(d));
      const onlyN = n.descs.filter((d) => !setB.has(d));
      mismatches.push(
        `${key}: descriptor-set drift — browser-only=[${onlyB.join(',')}] node-only=[${onlyN.join(',')}]`
      );
    }
    if (b.preface !== n.preface) {
      mismatches.push(`${key}: preface drift — browser="${b.preface}" node="${n.preface}"`);
    }
    if (VERBOSE) {
      console.error(
        `  ${key}: ${b.descs.length} descs, preface=${b.preface} ${descsB === descsN && b.preface === n.preface ? 'OK' : 'DRIFT'}`
      );
    }
  }

  if (mismatches.length) {
    console.error(`EQUIVALENCE: FAIL — ${mismatches.length} browser↔node disagreement(s)`);
    for (const m of mismatches) console.error('  ' + m);
    process.exit(1);
  }
  console.error(
    `EQUIVALENCE: ${FIXTURES.length}/${FIXTURES.length} PASS — browser and node agree on descriptor sets and preface suggestions`
  );
})().catch((e) => {
  console.error('EQUIVALENCE: harness crash — ' + (e && e.message));
  process.exit(1);
});

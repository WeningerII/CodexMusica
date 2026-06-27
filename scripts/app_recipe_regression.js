#!/usr/bin/env node
// app_recipe_regression.js — snapshot regression for the BROWSER recipe path.
//
// regression_recipes.js covers the CLI engine (search.js + translate.js). The
// shipped app renders recipes through its OWN code — makeCard, compileStack,
// compileRecipeStack — which the CLI regression does not exercise. This boots
// the freshly-built codex.html in jsdom, drives that path across all four
// output formats for a fixed instrument sample, and compares the result to
// tests/app_recipe_snapshot.json.
//
// USAGE
//   node scripts/app_recipe_regression.js            # verify against snapshot
//   node scripts/app_recipe_regression.js --update   # regenerate the snapshot
//                                                     # (after intentional app changes)

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

const SNAP = path.join(__dirname, '..', 'tests', 'app_recipe_snapshot.json');
const UPDATE = process.argv.includes('--update');

// Fixed instrument sample — keyed by id (not array index) so adding catalog
// entries does not shift the sample. Spans ensembles, plucked/bowed strings,
// percussion, winds, keys, and electronic instruments.
const SAMPLE_IDS = [
  'choir_ensemble',
  'mandolin',
  'guqin',
  'tanbur_persian',
  'kemence',
  'damaru',
  'muthallath',
  'taphon',
  'biniou',
  'mizmar',
  'combo_organ',
  'drum_machine_909',
  'choir_welsh_male',
];
const FORMATS = ['prose', 'tags', 'compact', 'rich'];

function buildTempHtml() {
  const tmp = path.join(os.tmpdir(), `codex_appreg_${process.pid}.html`);
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

function snapshotFromHtml(html) {
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
        const ids=${JSON.stringify(SAMPLE_IDS)}, fmts=${JSON.stringify(FORMATS)};
        const out={};
        for(const id of ids){
          let card; try{card=makeCard(id);}catch(e){out[id+'|ERR']=String(e&&e.message);continue;}
          if(!card){out[id]='<<null-card>>';continue;}
          for(const f of fmts){ try{out[id+'|'+f]=compileStack(card,f);}catch(e){out[id+'|'+f+'|ERR']=String(e&&e.message);} }
        }
        const c1=makeCard(ids[0]), c2=makeCard(ids[1]);
        if(c1&&c2){ for(const f of fmts){ try{out['RECIPE|'+f]=compileRecipeStack([c1,c2],f,{});}catch(e){out['RECIPE|'+f+'|ERR']=String(e&&e.message);} } }
        window.__snap=out;
      })();`;
      const s = dom.window.document.createElement('script');
      s.textContent = probe;
      dom.window.document.body.appendChild(s);
      const snap = dom.window.__snap || {};
      dom.window.close();
      resolve(snap);
    }, 1500);
  });
}

(async () => {
  const tmp = buildTempHtml();
  const html = fs.readFileSync(tmp, 'utf8');
  fs.unlinkSync(tmp);

  const snap = await snapshotFromHtml(html);
  const keys = Object.keys(snap);
  const errKeys = keys.filter((k) => k.endsWith('ERR'));
  if (errKeys.length) {
    console.error(`APP RECIPE REGRESSION: FAIL — ${errKeys.length} render error(s)`);
    for (const k of errKeys.slice(0, 8)) console.error(`  ${k}: ${snap[k]}`);
    process.exit(1);
  }

  // A missing snapshot is a FAILURE unless --update is explicit. Auto-creating it
  // and exiting 0 turned a deleted/renamed baseline into a self-blessing no-op
  // that asserts nothing (and silently writes a new baseline from whatever the
  // current — possibly broken — behavior is).
  if (!fs.existsSync(SNAP) && !UPDATE) {
    console.error(
      `APP RECIPE REGRESSION: FAIL — no snapshot at ${SNAP}. Run with --update to create one.`
    );
    process.exit(2);
  }
  if (UPDATE) {
    fs.writeFileSync(SNAP, JSON.stringify(snap, null, 2) + '\n');
    console.error(`APP RECIPE REGRESSION: snapshot updated — ${keys.length} entries`);
    process.exit(0);
  }

  const expected = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
  const allKeys = new Set([...Object.keys(expected), ...keys]);
  const drift = [];
  for (const k of allKeys) {
    if (JSON.stringify(expected[k]) !== JSON.stringify(snap[k])) drift.push(k);
  }
  if (drift.length) {
    console.error(
      `APP RECIPE REGRESSION: FAIL — ${drift.length} drifted entr${drift.length === 1 ? 'y' : 'ies'}`
    );
    for (const k of drift.slice(0, 10)) console.error(`  ${k}`);
    console.error('  (if intentional, re-run with --update)');
    process.exit(1);
  }

  console.error(`APP RECIPE REGRESSION: ${keys.length}/${keys.length} PASS`);
})();

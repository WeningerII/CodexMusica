#!/usr/bin/env node
// check_library_regression.js — no readable work may silently disappear.
//
// The native Library tab replaces a Site that served snapshot 5226b4fb. The
// owner's condition: no regression in the number of accessible works. Counts
// can hide a swap (one unit lost, another gained), so this gate compares id by
// id: every unit of every committed baseline manifest is classified against
// the current build's manifest, and every id on both sides is accounted for.
//
// BASELINES are the committed per-unit manifests in tests/library/, written by
// `python -m library.unit_manifest` (lyric-harness/library/unit_manifest.py).
// Each is pinned below by sha256, so an edit to a baseline fails here rather
// than quietly moving the bar. A new baseline is appended only when corpus
// content changes, in the corpus PR itself.
//
// CURRENT is the manifest of the build under test: --current=FILE. Without it,
// the newest committed baseline stands in (the --committed mode CI runs on
// every PR), which proves the baselines themselves reconcile.
//
// CLASSES, per baseline id against CURRENT:
//   unchanged               readable in both, same revision          pass
//   unchanged-non-readable  same non-readable availability            pass
//   missing                 id absent from CURRENT                    FAIL unless id-mapped
//   demoted                 readable -> non-readable                  FAIL unless ledgered (John)
//   promoted                non-readable -> readable                  pass, listed
//   transition              non-readable -> other non-readable        pass, listed
//   revised                 readable in both, revision differs        FAIL unless ledgered
// and per CURRENT id absent from the baseline: added (pass, listed).
//
// The catalog alone decides eligibility. This gate never promotes anything: a
// promotion is only reported, because CURRENT is the catalog's own output.
//
// LEDGERS (tests/library/, all empty at launch):
//   id-map.json               [{from, to, normalized_sha256}] an id renamed with identical text
//   eligibility-changes.json  [{id, from, to, reason, approved_by, date}]
//   revisions.json            [{id, from_revision, to_revision, reason}]
//
// Usage: node scripts/check_library_regression.js [--current=FILE] [--report=FILE] [--json]
// Exit 0 when every baseline id is accounted for and nothing failed; 1 otherwise.

'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'tests', 'library');

//: Committed baselines, oldest first, each pinned by the sha256 of its bytes.
const BASELINES = [
  {
    file: 'units-5226b4fb.tsv.gz',
    sha256: '6aaf98bdcb3b0b1c9275c9f178e4d39d4a996111cd7d4165c13ece272137f025',
  },
  {
    file: 'units-317c5afa.tsv.gz',
    sha256: '7ebe137c7bf295445e2b31ba2cb0af819fc9a56fc43aeb8899deeecacf07c562',
  },
];
const COLUMNS = [
  'reading_unit_id',
  'availability',
  'reading_revision',
  'artifact_sha256',
  'normalized_sha256',
  'admission',
];

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) throw new Error(`check_library_regression: unknown argument ${a}`);
    return [m[1], m[2] ?? true];
  })
);

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function parse(bytes, label) {
  const text = zlib.gunzipSync(bytes).toString('utf8');
  const header = {};
  const units = new Map();
  let columns = null;
  for (const line of text.split('\n')) {
    if (!line) continue;
    if (line.startsWith('# ')) {
      const m = line.slice(2).match(/^([^:]+): (.*)$/);
      if (m) header[m[1]] = m[2];
      continue;
    }
    if (!columns) {
      columns = line.split('\t');
      if (columns.join('\t') !== COLUMNS.join('\t'))
        throw new Error(`${label}: unexpected columns ${columns.join(',')}`);
      continue;
    }
    const cells = line.split('\t');
    if (cells.length !== COLUMNS.length) throw new Error(`${label}: malformed row ${line}`);
    const row = Object.fromEntries(COLUMNS.map((c, i) => [c, cells[i]]));
    if (units.has(row.reading_unit_id))
      throw new Error(`${label}: duplicate id ${row.reading_unit_id}`);
    units.set(row.reading_unit_id, row);
  }
  if (Number(header.units) !== units.size)
    throw new Error(`${label}: header says ${header.units} units, file has ${units.size}`);
  return { header, units };
}

function readLedger(name) {
  const file = path.join(DIR, name);
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new Error(`${name}: expected a JSON array`);
  return value;
}

function classify(base, current, ledgers) {
  const idMap = new Map(ledgers.idMap.map((e) => [e.from, e]));
  const demotions = new Set(ledgers.eligibility.map((e) => `${e.id}\0${e.from}\0${e.to}`));
  const revisions = new Set(
    ledgers.revisions.map((e) => `${e.id}\0${e.from_revision}\0${e.to_revision}`)
  );
  const classes = {
    unchanged: [],
    'unchanged-non-readable': [],
    missing: [],
    demoted: [],
    promoted: [],
    transition: [],
    revised: [],
    added: [],
  };
  const failures = [];
  const seen = new Set();
  for (const [id, b] of base.units) {
    let cur = current.units.get(id);
    let viaMap = null;
    if (!cur && idMap.has(id)) {
      const entry = idMap.get(id);
      const mapped = current.units.get(entry.to);
      if (mapped && mapped.normalized_sha256 === b.normalized_sha256) {
        cur = mapped;
        viaMap = entry.to;
      }
    }
    if (!cur) {
      classes.missing.push(id);
      failures.push(`missing: ${id} (${b.availability}) is absent and not id-mapped`);
      continue;
    }
    seen.add(viaMap || id);
    const wasReadable = b.availability === 'readable';
    const isReadable = cur.availability === 'readable';
    if (wasReadable && isReadable) {
      if (cur.reading_revision === b.reading_revision) classes.unchanged.push(id);
      else {
        classes.revised.push(id);
        if (!revisions.has(`${id}\0${b.reading_revision}\0${cur.reading_revision}`))
          failures.push(
            `revised: ${id} changed revision ${b.reading_revision.slice(0, 12)} -> ${cur.reading_revision.slice(0, 12)} without a revisions.json entry`
          );
      }
    } else if (wasReadable && !isReadable) {
      classes.demoted.push(id);
      if (!demotions.has(`${id}\0${b.availability}\0${cur.availability}`))
        failures.push(
          `demoted: ${id} went readable -> ${cur.availability} without an approved eligibility-changes.json entry`
        );
    } else if (!wasReadable && isReadable) classes.promoted.push(id);
    else if (b.availability === cur.availability) classes['unchanged-non-readable'].push(id);
    else classes.transition.push(id);
  }
  for (const id of current.units.keys()) if (!seen.has(id)) classes.added.push(id);

  // Every id on both sides is accounted for exactly once.
  const baseTotal = Object.entries(classes)
    .filter(([k]) => k !== 'added')
    .reduce((n, [, v]) => n + v.length, 0);
  if (baseTotal !== base.units.size)
    failures.push(
      `reconcile: baseline classes sum to ${baseTotal}, baseline has ${base.units.size}`
    );
  const currentTotal = seen.size + classes.added.length;
  if (currentTotal !== current.units.size)
    failures.push(
      `reconcile: matched ${seen.size} + added ${classes.added.length} = ${currentTotal}, current has ${current.units.size}`
    );
  return { classes, failures };
}

function main() {
  const ledgers = {
    idMap: readLedger('id-map.json'),
    eligibility: readLedger('eligibility-changes.json'),
    revisions: readLedger('revisions.json'),
  };
  for (const e of ledgers.eligibility)
    if (e.approved_by !== 'John' || !e.date || !e.reason)
      throw new Error(`eligibility-changes.json: entry for ${e.id} lacks John's dated approval`);

  const baselines = BASELINES.map(({ file, sha256: pinned }) => {
    const bytes = fs.readFileSync(path.join(DIR, file));
    const actual = sha256(bytes);
    if (actual !== pinned)
      throw new Error(
        `${file}: sha256 ${actual} differs from the pinned ${pinned}. Baselines are append-only.`
      );
    return { file, ...parse(bytes, file) };
  });

  const currentFile = args.current
    ? path.resolve(args.current)
    : path.join(DIR, BASELINES[BASELINES.length - 1].file);
  const current = parse(fs.readFileSync(currentFile), path.basename(currentFile));

  const report = {
    current: path.relative(ROOT, currentFile),
    snapshot: current.header.snapshot_id,
    baselines: [],
  };
  let failed = false;
  console.log('=== Library regression (id by id) ===');
  console.log(
    `current: ${report.current} (snapshot ${String(current.header.snapshot_id).slice(0, 8)}, ${current.units.size} units)`
  );
  for (const base of baselines) {
    const { classes, failures } = classify(base, current, ledgers);
    const counts = Object.fromEntries(Object.entries(classes).map(([k, v]) => [k, v.length]));
    report.baselines.push({
      file: base.file,
      snapshot: base.header.snapshot_id,
      counts,
      failures,
      ids: {
        missing: classes.missing,
        demoted: classes.demoted,
        revised: classes.revised,
        promoted: classes.promoted,
        transition: classes.transition,
      },
    });
    console.log(
      `\n${base.file} (snapshot ${String(base.header.snapshot_id).slice(0, 8)}, ${base.units.size} units)`
    );
    for (const [k, n] of Object.entries(counts)) console.log(`  ${k.padEnd(24)} ${n}`);
    if (failures.length) {
      failed = true;
      for (const f of failures.slice(0, 50)) console.log(`  ✗ ${f}`);
      if (failures.length > 50) console.log(`  … and ${failures.length - 50} more`);
    }
  }
  if (args.report)
    fs.writeFileSync(path.resolve(args.report), JSON.stringify(report, null, 2) + '\n');
  if (args.json) console.log(JSON.stringify(report));
  console.log(
    failed
      ? '\nFAIL — a baseline unit regressed (see above).'
      : '\nPASS — every baseline unit is accounted for.'
  );
  process.exit(failed ? 1 : 0);
}

main();

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
// Usage: node scripts/check_library_regression.js [--current=FILE] [--ledgers=DIR] [--report=FILE] [--json]
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
    sha256: 'c8b9b24e013440d7827ef8e567fa63123cbe395622450338c82845bc23f18bc7',
  },
  {
    file: 'units-317c5afa.tsv.gz',
    sha256: '1e0876c0b2e0c6a5e53fa8ee73a2f168a17e76927c0324f4d8d9a5454184d53f',
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

const AVAILABILITY = new Set(['readable', 'held', 'research_only', 'rejected']);
const ADMITTED = new Set([
  'ADMIT_PD_AFFIRMED',
  'ADMIT_DATE_VERIFIED',
  'ADMIT_PUBLICATION_VERIFIED',
]);
const HEX64 = /^[0-9a-f]{64}$/;
const UNIT_ID = /^reading_[0-9a-f-]{36}$/;
const VERDICT = /^(ADMIT|REJECT)_[A-Z_]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const filled = (v) => typeof v === 'string' && v.trim().length > 0;

// Every row is validated, current build and baseline alike: a manifest with an
// empty hash, an unknown availability, or a readable unit no admitting verdict
// supports is refused rather than classified. Ledgers cannot manufacture
// admission evidence; this runs before any ledger is consulted.
function validateRow(row, label) {
  const where = `${label}: ${row.reading_unit_id}`;
  if (!UNIT_ID.test(row.reading_unit_id)) throw new Error(`${where}: malformed reading_unit_id`);
  if (!AVAILABILITY.has(row.availability))
    throw new Error(`${where}: unknown availability ${JSON.stringify(row.availability)}`);
  for (const c of ['reading_revision', 'artifact_sha256', 'normalized_sha256'])
    if (!HEX64.test(row[c])) throw new Error(`${where}: ${c} is not a sha256 digest`);
  const verdicts = row.admission ? row.admission.split(',') : [];
  for (const v of verdicts) if (!VERDICT.test(v)) throw new Error(`${where}: bad verdict ${v}`);
  if (row.availability === 'readable' && !verdicts.some((v) => ADMITTED.has(v)))
    throw new Error(`${where}: readable without an admitting verdict`);
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
    validateRow(row, label);
    if (units.has(row.reading_unit_id))
      throw new Error(`${label}: duplicate id ${row.reading_unit_id}`);
    units.set(row.reading_unit_id, row);
  }
  if (Number(header.units) !== units.size)
    throw new Error(`${label}: header says ${header.units} units, file has ${units.size}`);
  for (const f of ['snapshot_id', 'builder_commit', 'policy.admitted_verdicts'])
    if (!filled(header[f])) throw new Error(`${label}: header lacks ${f}`);
  return { header, units };
}

function readLedger(dir, name) {
  const value = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  if (!Array.isArray(value)) throw new Error(`${name}: expected a JSON array`);
  return value;
}

// A ledger entry is evidence for a reviewer, not proof of authorization: the
// checks below refuse malformed entries; they cannot tell a real approval
// from a typed one.
function validateLedgers(ledgers) {
  const froms = new Set();
  const tos = new Set();
  for (const e of ledgers.idMap) {
    if (!UNIT_ID.test(e.from || '') || !UNIT_ID.test(e.to || '') || e.from === e.to)
      throw new Error(`id-map.json: malformed entry ${JSON.stringify(e)}`);
    if (!HEX64.test(e.normalized_sha256 || ''))
      throw new Error(`id-map.json: ${e.from} declares no normalized_sha256`);
    if (froms.has(e.from)) throw new Error(`id-map.json: ${e.from} is mapped twice`);
    if (tos.has(e.to)) throw new Error(`id-map.json: two ids map to ${e.to}`);
    froms.add(e.from);
    tos.add(e.to);
  }
  for (const e of ledgers.eligibility) {
    if (!UNIT_ID.test(e.id || '') || !AVAILABILITY.has(e.from) || !AVAILABILITY.has(e.to))
      throw new Error(`eligibility-changes.json: malformed entry ${JSON.stringify(e)}`);
    if (e.approved_by !== 'John' || !DATE.test(e.date || '') || isNaN(Date.parse(e.date)))
      throw new Error(`eligibility-changes.json: ${e.id} lacks John's dated approval`);
    if (!filled(e.reason)) throw new Error(`eligibility-changes.json: ${e.id} gives no reason`);
  }
  for (const e of ledgers.revisions) {
    if (
      !UNIT_ID.test(e.id || '') ||
      !HEX64.test(e.from_revision || '') ||
      !HEX64.test(e.to_revision || '')
    )
      throw new Error(`revisions.json: malformed entry ${JSON.stringify(e)}`);
    if (!filled(e.reason)) throw new Error(`revisions.json: ${e.id} gives no reason`);
  }
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
  // matchedBy: current id -> the baseline id it accounts for. Matching must be
  // injective, so one current unit can never stand in for two baseline units.
  const matchedBy = new Map();
  const claim = (curId, baseId) => {
    if (matchedBy.has(curId)) {
      failures.push(`collision: ${baseId} and ${matchedBy.get(curId)} both resolve to ${curId}`);
      return false;
    }
    matchedBy.set(curId, baseId);
    return true;
  };
  for (const [id, b] of base.units) {
    let cur = current.units.get(id);
    let curId = id;
    if (!cur && idMap.has(id)) {
      const entry = idMap.get(id);
      const mapped = current.units.get(entry.to);
      if (base.units.has(entry.to))
        failures.push(`id-map: ${id} -> ${entry.to}, but ${entry.to} is itself a baseline unit`);
      else if (!mapped)
        failures.push(`id-map: ${id} -> ${entry.to}, which the current build lacks`);
      else if (
        entry.normalized_sha256 !== b.normalized_sha256 ||
        entry.normalized_sha256 !== mapped.normalized_sha256
      )
        failures.push(`id-map: ${id} -> ${entry.to} declares a text hash neither row confirms`);
      else {
        cur = mapped;
        curId = entry.to;
      }
    }
    if (!cur) {
      classes.missing.push(id);
      failures.push(`missing: ${id} (${b.availability}) is absent and not id-mapped`);
      continue;
    }
    if (!claim(curId, id)) continue;
    const wasReadable = b.availability === 'readable';
    const isReadable = cur.availability === 'readable';
    if (cur.reading_revision === b.reading_revision) {
      // The revision hashes the whole reading: the same revision with other
      // stored bytes or other text is a corrupt or forged manifest.
      if (
        cur.artifact_sha256 !== b.artifact_sha256 ||
        cur.normalized_sha256 !== b.normalized_sha256
      )
        failures.push(
          `inconsistent: ${id} keeps revision ${b.reading_revision.slice(0, 12)} with different content hashes`
        );
    }
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
  for (const id of current.units.keys()) if (!matchedBy.has(id)) classes.added.push(id);

  // Every id on both sides is accounted for exactly once.
  const baseTotal = Object.entries(classes)
    .filter(([k]) => k !== 'added')
    .reduce((n, [, v]) => n + v.length, 0);
  if (baseTotal + failures.filter((f) => f.startsWith('collision:')).length !== base.units.size)
    failures.push(
      `reconcile: baseline classes sum to ${baseTotal}, baseline has ${base.units.size}`
    );
  const currentTotal = matchedBy.size + classes.added.length;
  if (currentTotal !== current.units.size)
    failures.push(
      `reconcile: matched ${matchedBy.size} + added ${classes.added.length} = ${currentTotal}, current has ${current.units.size}`
    );
  return { classes, failures };
}

function main() {
  const ledgerDir = args.ledgers ? path.resolve(args.ledgers) : DIR;
  const ledgers = {
    idMap: readLedger(ledgerDir, 'id-map.json'),
    eligibility: readLedger(ledgerDir, 'eligibility-changes.json'),
    revisions: readLedger(ledgerDir, 'revisions.json'),
  };
  validateLedgers(ledgers);

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

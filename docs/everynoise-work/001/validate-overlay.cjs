'use strict';
// Read-only research verification. Source integration and publication still require
// the shared merge lock and complete source/photo review in the assignment.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const work = __dirname;
const root = path.resolve(work, '../../..');
const read = (name) => JSON.parse(fs.readFileSync(name, 'utf8'));
const allocation = read(path.join(work, 'allocation.json'));
const claim = read(path.join(work, 'claim.json'));
const packets = fs.readdirSync(path.join(work, 'packets'))
  .filter((name) => /^\d\d-\d\d\.json$/.test(name))
  .sort().map((name) => read(path.join(work, 'packets', name)));
const entries = packets.flatMap((packet) => packet.entries);
const overlay = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-001-overlay-'));
for (const dir of ['references', 'scripts', 'src', 'data', 'tests'])
  fs.cpSync(path.join(root, dir), path.join(overlay, dir), { recursive: true });
const req = createRequire(path.join(overlay, 'scripts', 'validate.js'));
const baseline = req('./_loader.js');
const oldTraditions = new Map(baseline.TRADITIONS.map((t) => [t.id, structuredClone(t)]));
const oldExtras = structuredClone(baseline.TRADITION_EXTRAS);
const oldGeo = read(path.join(overlay, 'data/geo.json'));
const signatures = read(path.join(overlay, 'references/_tradition_signatures.json'));
const vocabulary = read(path.join(overlay, 'references/_soundword_vocab.json')).tokens;
const traditions = structuredClone(baseline.TRADITIONS);
const extras = structuredClone(baseline.TRADITION_EXTRAS);
const geo = structuredClone(oldGeo);
const expected = new Map(allocation.entries.map((entry) => [entry.source_label, entry]));
const seen = new Set();
const errors = [];
const familyParts = structuredClone(baseline.INSTRUMENT_FAMILY_PARTS);
const prerequisites = packets.flatMap((packet) => packet.prerequisites || []);
const registeredPrerequisites = [];
for (const prerequisite of prerequisites) {
  assert.equal(prerequisite.target_file, 'references/01_family_parts.js', 'unreviewed prerequisite target');
  const variant = prerequisite.variant;
  assert.equal(variant.auto, false, 'prerequisite must not be selected automatically');
  assert(!variant.default, 'prerequisite must not change a default');
  const part = familyParts[prerequisite.family]?.find((p) => p.id === prerequisite.part_id);
  assert(part, 'prerequisite family part missing');
  const existing = part.variants.find((v) => v.id === variant.id);
  if (existing) assert.deepEqual(existing, variant, 'conflicting prerequisite definition');
  else part.variants.push(variant);
  registeredPrerequisites.push({ family: prerequisite.family, part: part.id, variant: variant.id });
}
fs.writeFileSync(path.join(overlay, 'references/01_family_parts.js'), `const INSTRUMENT_FAMILY_PARTS = ${JSON.stringify(familyParts, null, 2)};\n`);
for (const row of entries) {
  const source = expected.get(row.source_label);
  if (!source || source.source_url !== row.source_url || seen.has(row.source_label)) {
    errors.push(`${row.source_label}: allocation mismatch or duplicate`);
    continue;
  }
  seen.add(row.source_label);
  if (!row.tradition || !row.extras || !row.geo || !row.signature_tokens) {
    errors.push(`${row.source_label}: proposed source record incomplete`);
    continue;
  }
  if (oldTraditions.has(row.id)) {
    errors.push(`${row.source_label}: proposed ID already exists; mapping needs explicit review`);
    continue;
  }
  traditions.push(row.tradition);
  extras[row.id] = row.extras;
  geo[row.id] = row.geo;
  signatures[row.id] = row.signature_tokens;
}
fs.writeFileSync(path.join(overlay, 'references/05_traditions.js'), `const TRADITIONS = ${JSON.stringify(traditions, null, 2)};\n`);
fs.writeFileSync(path.join(overlay, 'references/06_extras.js'), `const TRADITION_EXTRAS = ${JSON.stringify(extras, null, 2)};\n`);
fs.writeFileSync(path.join(overlay, 'data/geo.json'), JSON.stringify(geo, null, 2) + '\n');
fs.writeFileSync(path.join(overlay, 'references/_tradition_signatures.json'), JSON.stringify(signatures, null, 2) + '\n');
for (const name of Object.keys(require.cache))
  if (name.startsWith(overlay + path.sep)) delete require.cache[name];
const commands = {};
for (const script of ['build_signatures.js', 'validate.js']) {
  const result = spawnSync(process.execPath, [path.join(overlay, 'scripts', script)], { cwd: overlay, encoding: 'utf8' });
  commands[script] = { exit_code: result.status, stdout: result.stdout, stderr: result.stderr };
}
const C = req('./_loader.js');
const { seedTraditionCards, renderWorkspace } = req('./_seed_workspace.js');
const { seedFromTradition, search } = req('./search.js');
const { validateEntry } = req('./_atlas_regions.js');
const app = req('./_load_app.js').loadApp();
const imageManifest = read(path.join(overlay, 'references/_image_manifest.json'));
const instrumentPhotos = new Set(imageManifest.images.filter((i) => i.kind === 'instrument').map((i) => i.id));
const receipts = [];
for (const row of entries) {
  const receipt = { id: row.id, source_label: row.source_label, status: 'failed', errors: [], photo_complete: false };
  receipts.push(receipt);
  try {
    assert(row.tradition && row.extras && row.geo && row.signature_tokens, 'incomplete proposal');
    const t = C.TRADITIONS.find((t) => t.id === row.id);
    assert(t && t.pin_parts, 'missing pinned source definition');
    assert.equal(t.id, row.id, 'packet ID mismatch');
    assert.equal(Object.keys(row.extras.axes).length, 13, 'axes shape');
    assert.equal(validateEntry(row.id, row.geo).length, 0, 'invalid geographic anchor');
    for (const token of row.signature_tokens)
      assert(['sonic', 'style'].includes(vocabulary[token]?.class), `unclassified signature: ${token}`);
    const instruments = new Map(C.INSTRUMENTS.map((i) => [i.id, i]));
    for (const [part, variant] of Object.entries(t.parts || {}))
      assert(t.instruments.some((id) => instruments.get(id)?.parts.some((p) => p.id === part && p.variants.some((v) => v.id === variant))), `inapplicable override: ${part}:${variant}`);
    const cards = seedTraditionCards(row.id);
    const optimized = search(seedFromTradition(row.id), { maxIters: 100 }).config;
    assert.deepEqual(cards.map((c) => c.instrumentId), t.instruments, 'seed changed roster');
    assert.deepEqual(optimized.instruments.map((i) => i.id), t.instruments, 'search changed roster');
    let pins = 0;
    for (const card of cards) {
      const inst = instruments.get(card.instrumentId);
      const optimizedCard = optimized.instruments.find((i) => i.id === card.instrumentId);
      for (const [part, variant] of Object.entries(t.parts || {})) {
        if (!inst.parts.some((p) => p.id === part && p.variants.some((v) => v.id === variant))) continue;
        assert.equal(card.parts[part], variant, `seed lost ${card.instrumentId}/${part}`);
        assert.equal(optimizedCard.slots[part], variant, `search lost ${card.instrumentId}/${part}`);
        pins++;
      }
    }
    app.app.cards = [];
    app.app.collapsedTraditionGroups = new Set();
    app.importTradition(row.id);
    receipt.formats = {};
    for (const format of ['rich', 'prose', 'tags', 'compact']) {
      const text = renderWorkspace(cards, { format });
      const browser = app.compileRecipeStack(app.app.cards, format, {});
      assert.equal(text, browser, `${format}: browser/connector mismatch`);
      assert(text.length > 0 && text.length <= 1000, `${format}: invalid length`);
      receipt.formats[format] = { text, characters: text.length, byte_identical: true };
      assert(!/samul-percussive|kora-cascading|\berhuang\b|\boro-rolling\b|stride-trotting/i.test(text), `${format}: unsupported cultural or technique preface`);
      if (row.id === 'ambient_worship')
        assert(!/spoken-flowing/i.test(text), `${format}: sung vocal model rendered as speech`);
    }
    receipt.pins_checked = pins;
    receipt.cards = cards;
    receipt.optimized_config = optimized;
    receipt.instrument_photo_manifest_coverage = t.instruments.filter((id) => instrumentPhotos.has(id));
    receipt.instrument_photo_manifest_missing = t.instruments.filter((id) => !instrumentPhotos.has(id));
    receipt.status = 'production_paths_pass';
  } catch (error) { receipt.errors.push(error.message); }
}
let preserved = true;
for (const [id, before] of oldTraditions) {
  try {
    assert.deepEqual(C.TRADITIONS.find((t) => t.id === id), before);
    assert.deepEqual(C.TRADITION_EXTRAS[id], oldExtras[id]);
    assert.deepEqual(geo[id], oldGeo[id]);
  } catch (_) { preserved = false; errors.push(`old source changed: ${id}`); }
}
const report = {
  group_id: allocation.group_id,
  owner_token: claim.owner_token,
  research_baseline_commit: claim.baseline_commit,
  checked_at: new Date().toISOString(),
  temporary_overlay: overlay,
  assigned_count: allocation.expected_count,
  packet_count: packets.length,
  proposed_count: entries.length,
  missing_labels: allocation.entries.filter((e) => !seen.has(e.source_label)).map((e) => e.source_label),
  allocation_errors: errors,
  commands,
  registered_prerequisites: registeredPrerequisites,
  old_authored_sources_extras_geo_preserved: preserved,
  production_path_pass_count: receipts.filter((r) => r.status === 'production_paths_pass').length,
  complete: false,
  completion_note: 'Recipe-path checks do not certify source interpretation, photograph rights, photo HTTP/MIME/dimensions/visual inspection, full builds, CI or merge. Review blockers in each packet before integration.',
  receipts,
};
fs.writeFileSync(path.join(work, 'overlay-validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ proposed: report.proposed_count, passed: report.production_path_pass_count, complete: false, allocation_errors: errors, commands, failures: receipts.filter((r) => r.status !== 'production_paths_pass').map((r) => ({ id: r.id, errors: r.errors })) }, null, 2));
process.exitCode = report.production_path_pass_count === entries.length && errors.length === 0 && report.missing_labels.length === 0 && Object.values(commands).every((r) => r.exit_code === 0) ? 0 : 1;

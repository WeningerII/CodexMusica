// Library selection exports (docs/library-native-design.md, "Exports and
// downloads"): a public, deterministic ZIP of chosen readings, byte-identical
// to the approved Worker's (sites/library/lib/library-exports.ts with
// zip-stream.ts), served from a server-held plan.
//
// Three parts:
//   - the Worker's ZIP writer and entry builders, ported verbatim
//     (STORED ZIP64 with data descriptors, flags 0x808, fixed DOS time 1980,
//     deterministic entry order);
//   - an export store, built once per image from the verified site export:
//     every readable unit's export item (deflated) plus the size and CRC32 of
//     each of its entries in each format, so a plan knows its exact
//     Content-Length before a byte is generated;
//   - generation in a worker thread (library_export_worker.js), because a
//     long reading's item is tens of megabytes of JSON and must not block the
//     event loop that also serves /mcp and /chat. Every generated entry is
//     checked against its recorded size and CRC as it streams.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const encoder = new TextEncoder();
export const FORMATS = ['text', 'json', 'csv'];
export const EXPORTER_VERSION = 1;

// ── the Worker's canonical JSON (reader-crypto.ts) ────────────────────────
export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return (
    '{' +
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
      .join(',') +
    '}'
  );
}
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
// A file's sha256 in 1 MiB reads: the export tables run to hundreds of MB,
// and the image's peak-memory qualification counts every byte held at once.
function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const chunk = Buffer.allocUnsafe(1 << 20);
    for (let n; (n = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0; )
      hash.update(chunk.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

// ── zip-stream.ts, verbatim ───────────────────────────────────────────────
function block(size) {
  const bytes = new Uint8Array(size);
  return { bytes, view: new DataView(bytes.buffer) };
}
export function zipHeader(name) {
  const n = encoder.encode(name),
    { bytes, view } = block(30 + n.length + 20);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 45, true);
  view.setUint16(6, 0x808, true);
  view.setUint16(12, 0x21, true);
  view.setUint32(18, 0xffffffff, true);
  view.setUint32(22, 0xffffffff, true);
  view.setUint16(26, n.length, true);
  view.setUint16(28, 20, true);
  bytes.set(n, 30);
  view.setUint16(30 + n.length, 1, true);
  view.setUint16(32 + n.length, 16, true);
  return bytes;
}
export function zipDescriptor(crc, size) {
  const { bytes, view } = block(24);
  view.setUint32(0, 0x08074b50, true);
  view.setUint32(4, crc, true);
  view.setBigUint64(8, BigInt(size), true);
  view.setBigUint64(16, BigInt(size), true);
  return bytes;
}
export function zipCentral(name, crc, size, offset) {
  const n = encoder.encode(name),
    { bytes, view } = block(46 + n.length + 28);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 45 | (3 << 8), true);
  view.setUint16(6, 45, true);
  view.setUint16(8, 0x808, true);
  view.setUint16(14, 0x21, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, 0xffffffff, true);
  view.setUint32(24, 0xffffffff, true);
  view.setUint16(28, n.length, true);
  view.setUint16(30, 28, true);
  view.setUint32(38, 0x81a40000, true);
  view.setUint32(42, 0xffffffff, true);
  bytes.set(n, 46);
  const i = 46 + n.length;
  view.setUint16(i, 1, true);
  view.setUint16(i + 2, 24, true);
  view.setBigUint64(i + 4, BigInt(size), true);
  view.setBigUint64(i + 12, BigInt(size), true);
  view.setBigUint64(i + 20, BigInt(offset), true);
  return bytes;
}
export function zipEnd(entries, centralSize, centralOffset) {
  const { bytes, view } = block(98);
  view.setUint32(0, 0x06064b50, true);
  view.setBigUint64(4, BigInt(44), true);
  view.setUint16(12, 45, true);
  view.setUint16(14, 45, true);
  view.setBigUint64(24, BigInt(entries), true);
  view.setBigUint64(32, BigInt(entries), true);
  view.setBigUint64(40, BigInt(centralSize), true);
  view.setBigUint64(48, BigInt(centralOffset), true);
  view.setUint32(56, 0x07064b50, true);
  view.setBigUint64(64, BigInt(centralOffset + centralSize), true);
  view.setUint32(72, 1, true);
  view.setUint32(76, 0x06054b50, true);
  view.setUint16(84, 0xffff, true);
  view.setUint16(86, 0xffff, true);
  view.setUint32(88, 0xffffffff, true);
  view.setUint32(92, 0xffffffff, true);
  return bytes;
}
const headerBytes = (name) => 30 + encoder.encode(name).length + 20;
const centralBytes = (name) => 46 + encoder.encode(name).length + 28;
export const csvFields = [
  'snapshot_id',
  'reading_unit_id',
  'work_id',
  'edition_id',
  'reading_revision',
  'title',
  'language',
  'source_path',
  'source_sha256',
  'row_id',
  'physical_line',
  'analysis_line',
  'sung_line',
  'indent',
  'kind',
  'structure',
  'voice',
  'couplet',
  'hemistich',
  'text',
  'source_text',
  'terminator',
  'source_ranges',
  'normalized_cp_range',
  'normalized_utf16_range',
  'transformation_spans',
];
export function csvValue(value) {
  const s =
    value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}

// ── library-exports.ts entry builders, verbatim ───────────────────────────
// An export item is what the Worker read for one unit: the pack's reading as
// is, plus, for a header reading, its logical fields joined from their chunks
// (lines, normalized_text, source_text) and its exact JSON bytes joined from
// its raw fragments.
function provenance(reading, snapshot) {
  // eslint-disable-next-line no-unused-vars
  const { lines, normalized_text, source_text, search, source_map, ...identity } = reading;
  return {
    schema_version: 1,
    ...identity,
    snapshot_id: snapshot,
    coordinates: {
      source_map,
      body: 'Content JSON or CSV retains the exact source coordinates.',
    },
  };
}
function credits(r) {
  return `${r.title} [${r.reading_unit_id}]\nSource: ${r.source_path} (${r.source_sha256})\n${r.contributors.map((c) => `${c.role}: ${c.name}`).join('\n')}\nRecorded rights and required source declarations:\n${JSON.stringify(r.rights, null, 2)}\n`;
}
function csvLines(r, snapshot, lines) {
  const marks = (r.source_marks ?? [])
    .slice()
    .sort((a, b) => Number(a.physical_line ?? 0) - Number(b.physical_line ?? 0));
  let text = csvFields.map(csvValue).join(',') + '\r\n';
  for (const line of lines) {
    let structure = '',
      voice = '';
    for (const mark of marks) {
      if (Number(mark.physical_line ?? 0) > line.physical_line) break;
      const name = String(mark.name ?? '');
      if (/^(VOICE|SINGER|SPEAKER)/i.test(name)) voice = String(mark.raw ?? name);
      else structure = String(mark.raw ?? name);
    }
    const values = {
      ...r,
      ...line,
      snapshot_id: snapshot,
      row_id: line.id,
      structure,
      voice: line.voice ?? voice,
    };
    text += csvFields.map((k) => csvValue(values[k])).join(',') + '\r\n';
  }
  return text;
}

/** One unit's entries in order, as [name, text] (SOURCES excluded: see sourceEntry). */
export function unitEntries(item, format, snapshot) {
  const r = item.reading,
    id = r.reading_unit_id;
  const field = (name) => (item.fields && name in item.fields ? item.fields[name] : r[name]);
  const out = [];
  if (format === 'json') out.push([`READINGS/${id}.json`, item.json_text ?? canonical(r)]);
  else if (format === 'text') out.push([`READINGS/${id}.txt`, field('normalized_text')]);
  else out.push([`READINGS/${id}.csv`, csvLines(r, snapshot, field('lines'))]);
  out.push([`TRANSCRIPTIONS/${id}.txt`, field('source_text')]);
  out.push([`PROVENANCE/${id}.json`, canonical(provenance(r, snapshot)) + '\n']);
  out.push([`ATTRIBUTIONS/${id}.txt`, credits(r)]);
  for (const notice of r.rights.notices ?? []) {
    if (!notice || typeof notice.text !== 'string')
      throw exportError('STORAGE_CORRUPT', 'A required notice is missing.', 503);
    if (sha256(notice.text) !== notice.sha256)
      throw exportError('STORAGE_CORRUPT', 'A required notice checksum differs.', 503);
    out.push([`NOTICES/${id}-${notice.sha256}.txt`, notice.text]);
  }
  return out;
}
export function rootEntries(ids, snapshot) {
  return [
    [
      'PROVENANCE.json',
      canonical({
        schema_version: 1,
        snapshot_id: snapshot,
        scope: 'selected_readings',
        reading_unit_ids: ids,
        provenance_directory: 'PROVENANCE/',
        required_credits_directory: 'ATTRIBUTIONS/',
        notices_directory: 'NOTICES/',
        artwork_included: false,
        audio_included: false,
      }) + '\n',
    ],
    [
      'ATTRIBUTION.txt',
      'This package preserves pinned Library text, source credits and reuse terms in ATTRIBUTIONS/ and PROVENANCE/. Applicable notices are preserved verbatim in NOTICES/. Credits are required and must accompany reuse.\n',
    ],
  ];
}

export class ExportError extends Error {
  constructor(code, message, status = 400, remedy = 'Check the input and try again.', extra = {}) {
    super(message);
    Object.assign(this, { code, status, remedy, extra });
  }
}
export const exportError = (...args) => new ExportError(...args);

// ── the export store ──────────────────────────────────────────────────────
//   export-store.json   format, snapshot_id, counts, file sha256s
//   export-units.json   per readable unit (sorted by id): item offset/length
//                       in items.bin, whole-source flag, source sha, and per
//                       format the [name, size, crc] of each entry
//   items.bin           deflated export items
//   sources.bin         deflated whole-source texts; their [size, crc] and
//                       offsets in export-units.json's `sources`
const deflate = (text) => zlib.deflateRawSync(Buffer.from(text, 'utf8'), { level: 6 });
const entryFacts = (text) => {
  const bytes = Buffer.from(text, 'utf8');
  return [bytes.length, zlib.crc32(bytes)];
};

function readPacks(exportDir) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(exportDir, 'import_manifest.json'), 'utf8')
  );
  const refs = new Map(manifest.packs.map((ref) => [ref.path, ref]));
  const load = (p) => {
    const ref = refs.get(p);
    if (!ref) throw new Error(`unregistered pack ${p}`);
    const raw = zlib.gunzipSync(fs.readFileSync(path.join(exportDir, p)));
    if (raw.length !== ref.raw_bytes || sha256(raw) !== ref.raw_sha256)
      throw new Error(`pack checksum mismatch: ${p}`);
    return JSON.parse(raw.toString('utf8'));
  };
  return { manifest, refs, load };
}
// The Worker's logicalField: ordered, reconciled parts; arrays extended, strings joined.
function logical(load, item, field) {
  const paths = item.reading_chunks?.[field];
  if (!paths) return undefined;
  let value;
  paths.forEach((p, i) => {
    const part = load(p);
    if (
      part.part_index !== i ||
      part.part_count !== paths.length ||
      part.field !== field ||
      part.reading_unit_id !== item.summary.reading_unit_id ||
      part.reading_revision !== item.summary.reading_revision
    )
      throw new Error(`logical parts do not reconcile: ${item.summary.reading_unit_id} ${field}`);
    if (Array.isArray(part.value)) value = [...(value || []), ...part.value];
    else if (typeof part.value === 'string')
      value = (typeof value === 'string' ? value : '') + part.value;
    else throw new Error('invalid logical field');
  });
  return value;
}

/** Build the export store from a verified site export (image build time). */
export function buildExportStore(exportDir, outDir) {
  const { manifest, refs, load } = readPacks(exportDir);
  fs.mkdirSync(outDir, { recursive: true });
  const itemsFd = fs.openSync(path.join(outDir, 'items.bin'), 'w');
  const units = [];
  let itemsSize = 0;
  const snapshot = manifest.snapshot_id;
  const readingPacks = [...refs.values()]
    .filter((r) => r.kind === 'readings')
    .map((r) => r.path)
    .sort();
  for (const p of readingPacks)
    for (const pack of [load(p)])
      for (const item of pack.readings) {
        if (!item.reading) continue;
        if (item.summary.availability !== 'readable')
          throw new Error(`a held text cannot be admitted: ${item.summary.reading_unit_id}`);
        const exportItem = { reading: item.reading };
        if (item.reading_is_header) {
          exportItem.fields = {};
          for (const f of ['lines', 'normalized_text', 'source_text'])
            exportItem.fields[f] = logical(load, item, f);
        }
        if (item.reading_parts?.length) {
          let text = '';
          item.reading_parts.forEach((fp, i) => {
            const raw = load(fp);
            if (raw.part_index !== i || raw.part_count !== item.reading_parts.length)
              throw new Error('The exact reading fragments differ.');
            text += raw.raw_utf8_fragment;
          });
          exportItem.json_text = text;
        }
        const entries = {};
        for (const format of FORMATS)
          entries[format] = unitEntries(exportItem, format, snapshot).map(([name, text]) => [
            name,
            ...entryFacts(text),
          ]);
        const blob = deflate(JSON.stringify(exportItem));
        fs.writeSync(itemsFd, blob);
        units.push({
          id: item.reading.reading_unit_id,
          revision: item.reading.reading_revision,
          item: [itemsSize, blob.length],
          whole_source: item.summary.whole_source_availability === 'readable',
          source: item.summary.source_sha256,
          entries,
        });
        itemsSize += blob.length;
      }
  fs.closeSync(itemsFd);
  units.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Whole original sources, for the json format.
  const sourcesFd = fs.openSync(path.join(outDir, 'sources.bin'), 'w');
  const sources = {};
  let sourcesSize = 0;
  const wanted = new Set(units.filter((u) => u.whole_source).map((u) => u.source));
  for (const ref of [...refs.values()].filter((r) => r.kind === 'sources'))
    for (const source of load(ref.path).sources) {
      if (!wanted.has(source.sha256)) continue;
      const availability = manifest.whole_sources[source.sha256];
      if (availability?.availability !== 'readable') continue;
      if (sha256(source.text) !== source.sha256)
        throw new Error(`The original source checksum differs: ${source.sha256}`);
      const blob = deflate(source.text);
      fs.writeSync(sourcesFd, blob);
      sources[source.sha256] = [sourcesSize, blob.length, ...entryFacts(source.text)];
      sourcesSize += blob.length;
    }
  // Large sources are stored as raw fragments naming their artifact path,
  // joined in part order as the Worker's originalSource joined them.
  const parts = new Map();
  for (const ref of [...refs.values()].filter((r) => r.kind === 'fragments')) {
    const part = load(ref.path);
    const sha = /^sources\/([a-f0-9]{64})\.bin$/.exec(part.artifact_path || '')?.[1];
    if (!sha || !wanted.has(sha) || sources[sha]) continue;
    if (!parts.has(sha)) parts.set(sha, []);
    parts.get(sha).push(part);
  }
  for (const [sha, list] of parts) {
    if (manifest.whole_sources[sha]?.availability !== 'readable') continue;
    list.sort((a, b) => a.part_index - b.part_index);
    if (list.some((part, i) => part.part_index !== i || part.part_count !== list.length))
      throw new Error(`The original source fragments differ: ${sha}`);
    const text = list.map((part) => part.raw_utf8_fragment).join('');
    if (sha256(text) !== sha) throw new Error(`The original source checksum differs: ${sha}`);
    const blob = deflate(text);
    fs.writeSync(sourcesFd, blob);
    sources[sha] = [sourcesSize, blob.length, ...entryFacts(text)];
    sourcesSize += blob.length;
  }
  fs.closeSync(sourcesFd);
  for (const sha of wanted)
    if (!sources[sha])
      throw new Error(`A whole readable source is missing from the export: ${sha}`);

  fs.writeFileSync(path.join(outDir, 'export-units.json'), JSON.stringify({ units, sources }));
  const files = {};
  for (const name of ['export-units.json', 'items.bin', 'sources.bin'])
    files[name] = sha256(fs.readFileSync(path.join(outDir, name)));
  const store = {
    format: 1,
    exporter_version: EXPORTER_VERSION,
    snapshot_id: snapshot,
    rights_registry_sha256: manifest.derived_metadata?.rights_registry_sha256 ?? null,
    readable_count: units.length,
    files,
  };
  fs.writeFileSync(path.join(outDir, 'export-store.json'), JSON.stringify(store));
  return store;
}

/** The loaded export store: planning and the inputs generation reads. */
export class ExportStore {
  constructor(directory) {
    this.directory = directory;
    this.store = JSON.parse(fs.readFileSync(path.join(directory, 'export-store.json'), 'utf8'));
    if (this.store.format !== 1) throw new Error('Unsupported export store format');
    // Fail closed: every table is the one the build recorded, by sha256,
    // before anything in it is trusted. A misassembled export-units.json
    // (a NOTICES entry dropped, a revision changed) is refused here; the
    // per-entry CRCs checked while streaming cannot see an omission.
    const recorded = this.store.files || {};
    for (const name of ['export-units.json', 'items.bin', 'sources.bin']) {
      if (!/^[a-f0-9]{64}$/.test(recorded[name] || ''))
        throw new Error(`Export store records no sha256 for ${name}`);
      if (sha256File(path.join(directory, name)) !== recorded[name])
        throw new Error(`Export store table ${name} differs from its recorded sha256`);
    }
    const { units, sources } = JSON.parse(
      fs.readFileSync(path.join(directory, 'export-units.json'), 'utf8')
    );
    this.units = new Map(units.map((u) => [u.id, u]));
    this.sources = sources;
    if (this.units.size !== this.store.readable_count)
      throw new Error('Export store unit count mismatch');
    // A plan holds its selection as indices into this one sorted list (4 bytes
    // a reading), not as parsed id strings.
    this.ids = [...this.units.keys()].sort();
    this.indexOf = new Map(this.ids.map((id, i) => [id, i]));
  }
  get snapshotId() {
    return this.store.snapshot_id;
  }
  /**
   * The exact layout of a selection ZIP: every entry with its size and CRC,
   * in the Worker's order, and the total byte length.
   */
  layout(ids, format) {
    const entries = [];
    const seen = new Set();
    for (const id of ids) {
      const unit = this.units.get(id);
      for (const [name, size, crc] of unit.entries[format])
        entries.push({ kind: 'unit', id, item: unit.item, name, size, crc });
      if (format === 'json' && unit.whole_source && !seen.has(unit.source)) {
        seen.add(unit.source);
        const [offset, length, size, crc] = this.sources[unit.source];
        entries.push({
          kind: 'source',
          sha: unit.source,
          at: [offset, length],
          name: `SOURCES/${unit.source}.bin`,
          size,
          crc,
        });
      }
    }
    for (const [name, text] of rootEntries(ids, this.snapshotId))
      entries.push({ kind: 'root', name, text, ...facts(text) });
    let offset = 0,
      central = 0;
    for (const e of entries) {
      e.offset = offset;
      offset += headerBytes(e.name) + e.size + 24;
      central += centralBytes(e.name);
    }
    return { entries, centralOffset: offset, centralSize: central, bytes: offset + central + 98 };
  }
}
const facts = (text) => {
  const [size, crc] = entryFacts(text);
  return { size, crc };
};

/** content_id: the exact inputs the bytes are a function of. */
export function contentId(store, ids, format) {
  return sha256(
    canonical({
      exporter_version: EXPORTER_VERSION,
      format,
      snapshot_id: store.snapshotId,
      rights_registry_sha256: store.store.rights_registry_sha256,
      readings: ids.map((id) => [id, store.units.get(id).revision]),
    })
  );
}

// CLI: node mcp/library_exports.js build EXPORT_DIR OUT_DIR
if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] === 'build') {
  const store = buildExportStore(process.argv[3], process.argv[4]);
  console.log(JSON.stringify({ snapshot_id: store.snapshot_id, readable: store.readable_count }));
}

// ── generation (runs inside library_export_worker.js) ─────────────────────
function readAt(fd, offset, length) {
  const buf = Buffer.allocUnsafe(length);
  let got = 0;
  while (got < length) {
    const n = fs.readSync(fd, buf, got, length - got, offset + got);
    if (n <= 0) throw exportError('STORAGE_CORRUPT', 'The export store is truncated.', 503);
    got += n;
  }
  return buf;
}
/**
 * Yield the ZIP's bytes in order for a layout, verifying every entry's size
 * and CRC against the store's record as it goes. The caller already sent
 * Content-Length = layout.bytes.
 */
export function* zipChunks(directory, layout, format, snapshot, { tail = true } = {}) {
  const itemsFd = fs.openSync(path.join(directory, 'items.bin'), 'r');
  const sourcesFd = fs.openSync(path.join(directory, 'sources.bin'), 'r');
  try {
    let current = null; // { id, texts: Map(name -> text) }
    for (const e of layout.entries) {
      let text;
      if (e.kind === 'root') text = e.text;
      else if (e.kind === 'source') {
        const [offset, length] = e.at;
        text = zlib.inflateRawSync(readAt(sourcesFd, offset, length)).toString('utf8');
      } else {
        if (!current || current.id !== e.id) {
          const [offset, length] = e.item;
          const item = JSON.parse(
            zlib.inflateRawSync(readAt(itemsFd, offset, length)).toString('utf8')
          );
          current = { id: e.id, texts: new Map(unitEntries(item, format, snapshot)) };
        }
        text = current.texts.get(e.name);
      }
      const bytes = Buffer.from(text, 'utf8');
      if (bytes.length !== e.size || zlib.crc32(bytes) !== e.crc)
        throw exportError(
          'STORAGE_CORRUPT',
          `An export entry differs from its record: ${e.name}`,
          503
        );
      yield Buffer.from(zipHeader(e.name));
      yield bytes;
      yield Buffer.from(zipDescriptor(e.crc, e.size));
    }
    if (!tail) return; // a composed ZIP (analysis export) appends its own entries and directory
    for (const e of layout.entries) yield Buffer.from(zipCentral(e.name, e.crc, e.size, e.offset));
    yield Buffer.from(zipEnd(layout.entries.length, layout.centralSize, layout.centralOffset));
  } finally {
    fs.closeSync(itemsFd);
    fs.closeSync(sourcesFd);
  }
}

// ── analysis exports ──────────────────────────────────────────────────────
/**
 * The layout of a job's analysis export: the reading's own entries exactly as
 * a one-unit json selection lays them out (byte-identical bytes, from the
 * export store), then PROVENANCE.json and ATTRIBUTION.txt naming the job's
 * own snapshot, engine and resources, then ANALYSIS/ entries. Sizes are known
 * up front (evidence page sizes are recorded in the manifest's page refs), so
 * Content-Length is exact; analysis CRCs are computed while streaming.
 */
export function analysisLayout(
  store,
  { unitId, identity, manifestHash, partial, extras, pageSizes }
) {
  const base = store.layout([unitId], 'json');
  const unitEntries = base.entries.filter((e) => e.kind !== 'root');
  const provenance =
    canonical({
      schema_version: 1,
      snapshot_id: identity.snapshot_id,
      scope: 'whole_reading_unit_analysis',
      reading_unit_ids: [unitId],
      analysis_manifest_hash: manifestHash,
      partial,
      engine_commit: identity.engine_commit,
      resource_fingerprint: identity.resource_fingerprint,
      // The word cut the exported token numbers were counted under; a job
      // whose identity predates the field says so rather than guessing.
      reader_scheme:
        typeof identity.reader_scheme === 'string' ? identity.reader_scheme : 'unrecorded',
      provenance_directory: 'PROVENANCE/',
      required_credits_directory: 'ATTRIBUTIONS/',
      notices_directory: 'NOTICES/',
      artwork_included: false,
      audio_included: false,
    }) + '\n';
  const attribution = rootEntries([unitId], store.snapshotId)[1][1];
  const analysis = [
    { kind: 'bytes', name: 'PROVENANCE.json', bytes: Buffer.from(provenance) },
    { kind: 'bytes', name: 'ATTRIBUTION.txt', bytes: Buffer.from(attribution) },
    ...extras.map(([name, bytes]) => ({ kind: 'bytes', name, bytes })),
    ...pageSizes.map((size, i) => ({
      kind: 'page',
      index: i,
      name: `ANALYSIS/EVIDENCE/${String(i).padStart(8, '0')}.json`,
      size,
    })),
  ];
  for (const e of analysis) if (e.kind === 'bytes') e.size = e.bytes.length;
  const entries = [...unitEntries, ...analysis];
  let offset = 0,
    central = 0;
  for (const e of entries) {
    e.offset = offset;
    offset += headerBytes(e.name) + e.size + 24;
    central += centralBytes(e.name);
  }
  return {
    unitLayout: { entries: unitEntries },
    analysis,
    entries,
    centralOffset: offset,
    centralSize: central,
    bytes: offset + central + 98,
  };
}
/** The analysis part of a composed ZIP: local entries, then the whole directory and end. */
export function* analysisTail(layout, readPage) {
  for (const e of layout.analysis) {
    const bytes = e.kind === 'bytes' ? e.bytes : readPage(e.index);
    if (bytes.length !== e.size)
      throw exportError('STORAGE_CORRUPT', `An analysis entry changed size: ${e.name}`, 503);
    e.crc = zlib.crc32(bytes);
    yield Buffer.from(zipHeader(e.name));
    yield bytes;
    yield Buffer.from(zipDescriptor(e.crc, e.size));
  }
  for (const e of layout.entries) yield Buffer.from(zipCentral(e.name, e.crc, e.size, e.offset));
  yield Buffer.from(zipEnd(layout.entries.length, layout.centralSize, layout.centralOffset));
}

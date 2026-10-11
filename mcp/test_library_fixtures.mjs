// Shared fixtures for the Library export tests: a synthetic verified site
// export (the packs the export store builds from) and a minimal ZIP reader.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
export const NOTICE = 'A notice that must travel.';
export const SOURCE_TEXT = 'The whole original source.\n';
export const SOURCE_SHA = sha(SOURCE_TEXT);

export function reading(id, { revision = `rev_${id}`, text = 'line one\nline two' } = {}) {
  const lines = text.split('\n').map((row, i) => ({
    id: `line_${id}_${i}`,
    physical_line: i + 1,
    analysis_line: i + 1,
    kind: 'lyric',
    text: row,
    source_text: row,
  }));
  return {
    reading_unit_id: id,
    reading_revision: revision,
    work_id: `work_${id}`,
    edition_id: `ed_${id}`,
    title: `Title, "${id}"`,
    language: 'eng',
    source_path: `corpus/${id}.txt`,
    source_sha256: SOURCE_SHA,
    contributors: [{ role: 'author', name: 'Anon' }],
    rights: {
      basis: 'public domain',
      notices: [{ sha256: sha(NOTICE), text: NOTICE, scope: 'all' }],
    },
    source_marks: [{ physical_line: 1, name: 'VERSE', raw: '[Verse]' }],
    source_map: { rows: lines.map((l) => l.id) },
    lines,
    normalized_text: text,
    source_text: text,
    search: { text, spans: [] },
  };
}
export function writeExport(dir, readings, { snapshot = 'snap', wholeSource = true } = {}) {
  fs.mkdirSync(path.join(dir, 'packs'), { recursive: true });
  const packs = [];
  const put = (name, kind, value) => {
    const raw = Buffer.from(JSON.stringify(value));
    fs.writeFileSync(path.join(dir, name), zlib.gzipSync(raw));
    packs.push({ path: name, kind, raw_bytes: raw.length, raw_sha256: sha(raw) });
  };
  put('packs/readings-00000.json.gz', 'readings', {
    snapshot_id: snapshot,
    readings: readings.map((r) => ({
      summary: {
        reading_unit_id: r.reading_unit_id,
        reading_revision: r.reading_revision,
        availability: 'readable',
        whole_source_availability: wholeSource ? 'readable' : 'held',
        source_sha256: SOURCE_SHA,
      },
      reading: r,
      reading_chunks: {},
      reading_is_header: false,
      reading_parts: [],
    })),
  });
  put('packs/sources-00000.json.gz', 'sources', {
    snapshot_id: snapshot,
    sources: [{ path: `sources/${SOURCE_SHA}.bin`, sha256: SOURCE_SHA, text: SOURCE_TEXT }],
  });
  fs.writeFileSync(
    path.join(dir, 'import_manifest.json'),
    JSON.stringify({
      snapshot_id: snapshot,
      packs,
      whole_sources: { [SOURCE_SHA]: { availability: wholeSource ? 'readable' : 'held' } },
      derived_metadata: { rights_registry_sha256: 'r'.repeat(64) },
    })
  );
}

/** Entries of a STORED ZIP64 archive, in central-directory order: [{name, data}]. */
export function readZip(buf) {
  const end = buf.length - 98;
  if (buf.readUInt32LE(end) !== 0x06064b50) throw new Error('no zip64 end record');
  const count = Number(buf.readBigUInt64LE(end + 24));
  let at = Number(buf.readBigUInt64LE(end + 48));
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error('bad central header');
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen);
    const x = at + 46 + nameLen;
    const size = Number(buf.readBigUInt64LE(x + 4));
    const local = Number(buf.readBigUInt64LE(x + 20));
    const crc = buf.readUInt32LE(at + 16);
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(dataAt, dataAt + size);
    if (zlib.crc32(data) !== crc) throw new Error(`CRC mismatch: ${name}`);
    out.push({ name, data });
    at = x + extraLen + commentLen;
  }
  return out;
}

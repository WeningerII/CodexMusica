// usage: node make_catalog.mjs <TREE> <catalogDir>
// Builds a minimal pinned English reader catalog holding one reading whose
// first line is the known repro 'Oh--oh, oh my love'.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [tree, dir] = process.argv.slice(2);
const { canonicalJSON } = await import(pathToFileURL(path.join(tree, 'mcp/reader_scheduler.js')));
const sha = (b) => createHash('sha256').update(b).digest('hex');
mkdirSync(path.join(dir, 'readings'), { recursive: true });
const text = 'Oh--oh, oh my love\nI give it all above';
const source = {
  reading_unit_id: 'unit_oh',
  language: 'eng',
  availability: 'readable',
  source_sha256: sha('bb8 original'),
  normalized_sha256: sha(text),
  work_id: 'work_oh',
  edition_id: 'edition_oh',
  normalized_text: text,
};
source.reading_revision = sha(canonicalJSON(source));
const sourceBytes = JSON.stringify(source);
const rel = `readings/${source.reading_unit_id}.json`;
writeFileSync(path.join(dir, rel), sourceBytes);
const indexBytes = JSON.stringify({ readings: [] });
writeFileSync(path.join(dir, 'index.json'), indexBytes);
const manifest = {
  parser_version: 'bb8fixture',
  normalizer_version: 'bb8fixture',
  artifacts: { 'index.json': sha(indexBytes), [rel]: sha(sourceBytes) },
};
manifest.snapshot_id = sha(canonicalJSON(manifest));
writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
console.log(
  JSON.stringify({
    snapshot_id: manifest.snapshot_id,
    reading_unit_id: source.reading_unit_id,
    reading_revision: source.reading_revision,
  })
);

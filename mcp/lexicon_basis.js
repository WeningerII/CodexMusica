// lexicon_basis.js — WHICH SUPPLEMENT A RUN READS, AND THAT IT KEEPS READING IT.
//
// The reviewed lexicon supplement (lyric-harness/quality/lexicon_supplement.py)
// ships as FROZEN versions named in lyric-harness/data/
// lexicon_supplement_versions.json. Every reading tool declares one as
// `lexicon_supplement` (an id, or `none` for CMUdict alone) and records the
// version's file sha256 beside it as `lexicon_supplement_sha256`.
//
// THE ORDER IS THE CONTRACT. A call first INHERITS what its run, state or
// checkpoint recorded (the callers do that before calling `applyLexiconBasis`);
// only then is an omitted declaration filled — with `none` for a continuation
// whose record predates this field (it was graded on CMUdict alone, and stays
// there), and with the manifest's default only for NEW work. A declared id the
// build does not ship, or a recorded sha256 that is not the shipped file's,
// refuses: no version is ever substituted for another. The harness checks the
// file's bytes again against both (`--lexicon-supplement-sha256`).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const NONE = 'none';
export const UNAVAILABLE = 'LEXICON_SUPPLEMENT_UNAVAILABLE';
const SHA256 = /^[0-9a-f]{64}$/;
const MANIFEST = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'lyric-harness',
  'data',
  'lexicon_supplement_versions.json'
);

function loadManifest() {
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const versions = Array.isArray(m?.versions) ? m.versions : [];
  if (
    m?.version !== 1 ||
    !versions.length ||
    versions.some((v) => !/^v[1-9][0-9]*$/.test(v?.id) || !SHA256.test(v?.sha256)) ||
    !versions.some((v) => v.id === m.default)
  )
    throw new Error(`${MANIFEST}: not a valid lexicon supplement manifest`);
  return Object.freeze({
    default: m.default,
    versions: Object.freeze(versions.map((v) => Object.freeze({ id: v.id, sha256: v.sha256 }))),
  });
}

// Read once: the manifest ships in the image beside the files it names, and a
// running service never changes them.
export const LEXICON_MANIFEST = loadManifest();
export const LEXICON_CHOICES = Object.freeze([NONE, ...LEXICON_MANIFEST.versions.map((v) => v.id)]);

const refusal = (message) => {
  const error = new Error(`${UNAVAILABLE}: ${message}`);
  error.isRefusal = true;
  return error;
};

const shipped = () => `${LEXICON_CHOICES.slice(1).join(', ')}; or \`${NONE}\``;

// -> the manifest row for a declared id, or null for `none`. Throws a refusal
// for an unknown id or a recorded sha256 that is not the shipped file's.
export function resolveLexiconBasis(id, sha256) {
  if (id === NONE) {
    if (sha256 != null)
      throw refusal('a supplement sha256 was declared with lexicon_supplement `none`.');
    return null;
  }
  const row = LEXICON_MANIFEST.versions.find((v) => v.id === id);
  if (!row)
    throw refusal(
      `lexicon supplement ${JSON.stringify(id)} is not one this build ships (it ships: ${shipped()}). A saved run is never moved to another version: keep its draft and start a new run under a shipped one.`
    );
  if (sha256 != null && sha256 !== row.sha256)
    throw refusal(
      `the run was graded under lexicon supplement ${id} with sha256 ${sha256}, and this build's ${id} is ${row.sha256}. The run's basis cannot be served; keep its draft and start a new run.`
    );
  return row;
}

// A state or checkpoint from another build can record a version this build
// does not ship. Refuse it by name before the declarations are parsed, where
// it would otherwise surface as a bare schema error.
export function assertRecordedLexicon(decl) {
  const id = decl?.lexicon_supplement;
  if (id != null) resolveLexiconBasis(id, decl.lexicon_supplement_sha256 ?? null);
}

// Fill and check `a.lexicon_supplement` / `a.lexicon_supplement_sha256` IN
// PLACE, after every inherited declaration has been carried in. `continuing`
// is true when the call resumes recorded work (a run record, a state or a
// checkpoint): an omission there means the record predates this field, which
// is `none`, never the current default.
export function applyLexiconBasis(a, { continuing = false } = {}) {
  if (a.lexicon_supplement === undefined || a.lexicon_supplement === null)
    a.lexicon_supplement = continuing ? NONE : LEXICON_MANIFEST.default;
  const row = resolveLexiconBasis(a.lexicon_supplement, a.lexicon_supplement_sha256 ?? null);
  if (row) a.lexicon_supplement_sha256 = row.sha256;
  else delete a.lexicon_supplement_sha256;
  return a;
}

// The harness globals for a resolved basis (ahead of the verb, like --voices).
export function lexiconGlobals(a) {
  if (!a || a.lexicon_supplement == null || a.lexicon_supplement === NONE) return [];
  const out = [`--lexicon-supplement=${a.lexicon_supplement}`];
  if (a.lexicon_supplement_sha256)
    out.push(`--lexicon-supplement-sha256=${a.lexicon_supplement_sha256}`);
  return out;
}

// -> the authenticated record's `lexicon` identity, or undefined when the
// record carries none or a malformed one.
export function lexiconIdentityOf(record) {
  const l = record?.lexicon;
  if (!l || typeof l !== 'object') return undefined;
  const id = l.supplement_id,
    sha = l.sha256;
  if (id === null && sha === null) return { supplement_id: null, sha256: null };
  if (typeof id === 'string' && typeof sha === 'string' && SHA256.test(sha))
    return { supplement_id: id, sha256: sha };
  return undefined;
}

// BB8: candidate's library-import on the main-made bundle, no UI.
const fs = require('fs');
const { webcrypto } = require('crypto');
const TREE = process.env.TREE;
global.CMLyricTokens = require(TREE + '/src/lyric-tokens.js');
const api = require(TREE + '/src/library-import.js');
(async () => {
  const file = process.argv[2];
  const bytes = fs.readFileSync(file);
  const raw = JSON.parse(bytes);
  const v = await api.validateEnvelope(raw, webcrypto);
  console.log('validateEnvelope: ok, digest', v.digest === raw.digest, raw.digest);
  console.log('recomputed digest', await api.envelopeDigest(raw, webcrypto));
  const d = api.importedDraft(v, Date.now());
  console.log('draft text === payload.text', d.text === raw.payload.text);
  console.log('libraryOrigin.declarations', JSON.stringify(d.meta.libraryOrigin.declarations));
  const wc = await api.makeWorkingCopyEnvelope(d.text, d.meta, webcrypto);
  console.log('re-exported working copy (unadapted) declarations', JSON.stringify(wc.payload.declarations));
  console.log('re-exported workingCopy.declarations', JSON.stringify(wc.payload.provenance.workingCopy.declarations));
  // tamper check: the digest still guards the declarations
  const t = JSON.parse(bytes);
  t.payload.declarations[0].pronunciations[0].token = 3;
  try { await api.validateEnvelope(t, webcrypto); console.log('tampered: ACCEPTED'); }
  catch (e) { console.log('tampered (token 2->3 in file): refused:', e.message); }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });

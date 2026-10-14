// BB8 verify: lyric_check operations written in sessions by one tree, read back
// with get_operation on another, and a declaration copied from the read-back
// options graded in a NEW session on the reading tree.
// usage: node --import ./reg.mjs sess.mjs <tree> write <store> <ids.json>
//        node --import ./reg.mjs sess.mjs <tree> read  <store> <ids.json> <out.json> [skipgrade]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [tree, mode, storeDir, idsFile, out, skip] = process.argv.slice(2);
const m = (f) => pathToFileURL(path.join(tree, 'mcp', f)).href;
const { buildWorkflowServer } = await import(m('workflow_tools.js'));
const { WorkflowSessions, SESSION_STORE_LIMITS } = await import(m('workflow_sessions.js'));
const { JobStore } = await import(m('job_store.js'));
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
const store = new JobStore(storeDir, SESSION_STORE_LIMITS);
const sessions = new WorkflowSessions({ store, build: {} });
const server = await buildWorkflowServer({ sessions, compatibility: true });
const client = new Client({ name: 'bb8-verify-sess', version: '1' }, { capabilities: {} });
const [a, b] = InMemoryTransport.createLinkedPair();
await server.connect(a); await client.connect(b);
const call = (name, args) => client.callTool({ name, arguments: args }, undefined, { timeout: 300000 });
const blocks = (r) => (r.content || []).map((c) => { try { return JSON.parse(c.text); } catch { return c.text; } });
const receipt = (r) => r.structuredContent ?? blocks(r).at(-1);
async function poll(id) {
  for (;;) {
    const r = await call('get_operation', { operation_id: id });
    const v = receipt(r);
    if (v?.status !== 'pending') return r;
    await new Promise((res) => setTimeout(res, 300));
  }
}
const find = (r, key) => {
  const walk = (x) => {
    if (!x || typeof x !== 'object') return undefined;
    if (key in x) return x[key];
    for (const v of Object.values(x)) { const f = walk(v); if (f !== undefined) return f; }
    return undefined;
  };
  for (const blk of blocks(r)) {
    if (typeof blk === 'string') { try { const f = walk(JSON.parse(blk)); if (f !== undefined) return f; } catch {} }
    const f = walk(blk); if (f !== undefined) return f;
  }
  return undefined;
};
const SETS = {
  finding: ['Wind--wind, wind my vrexl', 'Azure vrexl'],
  endword: ['Wind--wind, wind', 'Azure vrexl'],
};
async function checkIn(sessionId, lines, extra = {}) {
  const r = await call('lyric_check', { session_id: sessionId, lines, scheme: 'AA', ...extra });
  const op = receipt(r);
  if (!op?.operation_id) return { refused: true, isError: !!r.isError, blocks: blocks(r) };
  const done = await poll(op.operation_id);
  return { op: op.operation_id, done };
}
if (mode === 'write') {
  const ids = {};
  for (const [k, lines] of Object.entries(SETS)) {
    const s0 = receipt(await call('begin_lyrics', { phase: 'edit' }));
    const c = await checkIn(s0.session_id, lines);
    ids[k] = c.op;
  }
  fs.writeFileSync(idsFile, JSON.stringify(ids));
  console.log('written', JSON.stringify(ids));
} else {
  const ids = JSON.parse(fs.readFileSync(idsFile, 'utf8'));
  const res = { tree, reads: {} };
  const items = (o) => (o?.items || []).map((i) => ({ line: i.line, token: i.token, word: i.word, n_readings: i.dictionary_readings?.length }));
  for (const [k, op] of Object.entries(ids)) {
    const lines = SETS[k];
    const oldP = await call('get_operation', { operation_id: op, detail: 'pronunciations' });
    const oldShort = await call('get_operation', { operation_id: op });
    const oldFull = await call('get_operation', { operation_id: op, detail: 'full' });
    // the old session itself, continued on this tree
    const cont = await call('lyric_check', { session_id: op, lines, scheme: 'AA' });
    const s1 = receipt(await call('begin_lyrics', { phase: 'edit' }));
    const fresh = await checkIn(s1.session_id, lines);
    const freshP = await call('get_operation', { operation_id: fresh.op, detail: 'pronunciations' });
    res.reads[k] = {
      old_op: op,
      old_options: items(find(oldP, 'pronunciation_options')),
      old_short_blocks: blocks(oldShort),
      old_full_text_has: Object.fromEntries(['reader_scheme', 'token_scheme', 'cut', 'scheme v', 'v1', 'semantic', 'earlier release', 'MIGRATION', 'stale', 'STALE'].map((w) => [w, JSON.stringify(blocks(oldFull)).includes(w)])),
      old_full_receipt: receipt(oldFull),
      continue_old_session: { isError: !!cont.isError, blocks: blocks(cont) },
      fresh_options: items(find(freshP, 'pronunciation_options')),
    };
  }
  fs.writeFileSync(path.join(path.dirname(out), 'oldfull_' + path.basename(out)), JSON.stringify(Object.fromEntries(await Promise.all(Object.entries(ids).map(async ([k, op]) => [k, blocks(await call('get_operation', { operation_id: op, detail: 'full' }))]))), null, 1));
  if (!skip) {
    // The caller copies the standalone 'wind' entry from the OLD options of the
    // endword op (its intended word: the line's last word), declares it W AY1 N D
    // (the verb), and declares the coinage 'vrexl' as V R IH1 N D. Intended
    // meaning: end 'wind' (AY1) against 'vrexl' (IH1 N D) -> not a RHYME.
    const L = SETS.endword;
    const oldWind = res.reads.endword.old_options.filter((o) => o.line === L[0] && o.word === 'wind');
    const vrexl = { line: L[1], token: 2, word: 'vrexl', phones: ['V', 'R', 'IH1', 'N', 'D'], basis: 'declared', source: 'the writer: coinage, rhymes with sinned' };
    const decl = (tok) => [{ line: L[0], token: tok, word: 'wind', phones: ['W', 'AY1', 'N', 'D'], basis: 'dictionary', source: 'the singer: the verb' }, vrexl];
    res.copied_from_old = oldWind;
    res.grades = [];
    const toks = [...new Set([...oldWind.map((o) => o.token), 2, 3])];
    for (const tok of toks) {
      const s = receipt(await call('begin_lyrics', { phase: 'edit' }));
      const g = await checkIn(s.session_id, L, { relation: 'class:RHYME', pronunciations: decl(tok) });
      if (g.refused) { res.grades.push({ token: tok, refused_at_submit: g }); continue; }
      const short = blocks(g.done);
      const pr = await call('get_operation', { operation_id: g.op, detail: 'pronunciations' });
      const fi = await call('get_operation', { operation_id: g.op, detail: 'findings' });
      res.grades.push({
        token: tok,
        short_verdict: short,
        pronunciations_echo: find(pr, 'pronunciations'),
        findings: (find(fi, 'findings') || []).map((f) => `${f.code} ${f.severity ?? ''} ${(f.locations || []).join(',')} ${String(f.message ?? f.text ?? '').slice(0, 160)}`),
      });
    }
  }
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, (k, v) => (k === 'old_short_blocks' || k === 'short_verdict' ? undefined : v), 1).slice(0, 7000));
}
await client.close(); await server.close(); process.exit(0);

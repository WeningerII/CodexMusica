// BB8: list the files mcp/build_identity.js runtimeSourceFingerprint hashes,
// with the SAME walk rule (copied, not imported, so both trees use one rule),
// and diff the two trees' per-file hashes. Also recomputes the fingerprint to
// prove the copied rule matches the tree's own function.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

function walk(root) {
  const files = new Map();
  const hash = crypto.createHash('sha256');
  function visit(relative) {
    const directory = path.join(root, relative);
    if (!fs.existsSync(directory)) return;
    for (const item of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      if (
        item.name.startsWith('.') ||
        ['node_modules', '__pycache__', 'data', 'corpus', 'tests'].includes(item.name)
      )
        continue;
      const name = path.join(relative, item.name);
      if (item.isDirectory()) visit(name);
      else if (
        /\.(js|mjs|py)$/.test(item.name) ||
        ['package-lock.json', 'requirements-runtime.txt', 'production-config.json'].includes(item.name)
      ) {
        const bytes = fs.readFileSync(path.join(root, name));
        hash.update(name.replaceAll(path.sep, '/') + '\0');
        hash.update(bytes);
        hash.update('\0');
        files.set(name, crypto.createHash('sha256').update(bytes).digest('hex'));
      }
    }
  }
  for (const d of ['mcp', 'lyric-harness', 'scripts', 'references']) visit(d);
  return { files, digest: hash.digest('hex') };
}
const [baseTree, candTree] = process.argv.slice(2);
const out = {};
for (const [label, tree] of [
  ['base', baseTree],
  ['cand', candTree],
]) {
  const w = walk(tree);
  const { runtimeSourceFingerprint } = await import(
    pathToFileURL(path.join(tree, 'mcp', 'build_identity.js')).href
  );
  out[label] = { w, own: runtimeSourceFingerprint() };
  console.log(label, 'files', w.files.size, 'copied-rule digest', w.digest, 'tree function', out[label].own, w.digest === out[label].own ? 'MATCH' : 'MISMATCH');
}
const changed = [];
for (const [f, h] of out.cand.w.files) if (out.base.w.files.get(f) !== h) changed.push((out.base.w.files.has(f) ? 'M ' : 'A ') + f);
for (const f of out.base.w.files.keys()) if (!out.cand.w.files.has(f)) changed.push('D ' + f);
console.log('fingerprinted files that differ base->cand:', changed.length);
for (const c of changed.sort()) console.log('  ' + c);
const runtime = changed.filter((c) => !/\/test_|\/fixtures\/|\/results\/|check_|scripts\/test_/.test(c));
console.log('of which not test/fixture/results/check scripts:', runtime.length);
for (const c of runtime.sort()) console.log('  * ' + c);

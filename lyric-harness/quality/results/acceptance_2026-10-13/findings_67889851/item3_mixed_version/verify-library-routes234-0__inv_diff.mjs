import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')));
const h = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
console.log('assets_sha256 main', h(a.assets), 'cand', h(b.assets));
const byId = (inv) => new Map(inv.assets.map((x) => [x.id, x]));
const A = byId(a), B = byId(b);
const ids = [...new Set([...A.keys(), ...B.keys()])];
const differing = ids.filter((id) => JSON.stringify(A.get(id)) !== JSON.stringify(B.get(id)));
console.log('asset ids total', ids.length, 'differing', JSON.stringify(differing));
for (const id of differing) console.log(id, 'main=', JSON.stringify(A.get(id)), '\n   cand=', JSON.stringify(B.get(id)));
// Substitute only the differing (cmudict) entries from the candidate into main's inventory
const patched = a.assets.map((x) => (differing.includes(x.id) ? B.get(x.id) : x));
console.log('main assets with candidate cmudict entry substituted ->', h(patched), h(patched) === h(b.assets) ? 'EQUAL to candidate' : 'DIFFERENT');
console.log('ordering same', JSON.stringify(a.assets.map((x) => x.id)) === JSON.stringify(b.assets.map((x) => x.id)));

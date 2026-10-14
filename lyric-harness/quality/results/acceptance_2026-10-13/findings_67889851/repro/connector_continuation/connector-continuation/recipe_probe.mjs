// BB8: a caller-held recipe `workspace` from one tree passed to another's raw engine.
// usage: node --import ./nm_register.mjs recipe_probe.mjs <tree> start <out.json>
//        node --import ./nm_register.mjs recipe_probe.mjs <tree> edit <in.json> <out.json>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [tree, mode, file, out] = process.argv.slice(2);
const { buildServer } = await import(pathToFileURL(path.join(tree, 'mcp', 'tools.js')).href);
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
const server = buildServer({ task: { domain: 'recipe' } });
const client = new Client({ name: 'bb8-recipe', version: '1' }, { capabilities: {} });
const [a, b] = InMemoryTransport.createLinkedPair();
await Promise.all([client.connect(a), server.connect(b)]);
const call = (name, args) => client.callTool({ name, arguments: args });
const first = (r) => JSON.parse(r.content[0].text);
const edits = [{ action: 'set_environment', chain: { mic: 'hydrophone_piezo' } }];
if (mode === 'start') {
  const s = first(await call('start_recipe', { traditions: ['appalachian_folk'] }));
  const e = await call('edit_recipe', { workspace: s.workspace, edits });
  fs.writeFileSync(file, JSON.stringify({ workspace: s.workspace, recipe_after_edit: first(e).recipe }));
  console.log('start ok; workspace keys', Object.keys(s.workspace));
} else {
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  const e = await call('edit_recipe', { workspace: saved.workspace, edits });
  const res = {
    isError: !!e.isError,
    text: e.isError ? e.content.map((c) => c.text).join('\n') : undefined,
    identical_recipe: !e.isError && first(e).recipe === saved.recipe_after_edit,
  };
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res));
}
await client.close();
await server.close();
process.exit(0);

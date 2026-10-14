import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const MCP = process.argv[2];
const req = createRequire(MCP + '/package.json');
const imp = (m) => import(pathToFileURL(req.resolve(m)).href);
const { InMemoryTransport } = await imp('@modelcontextprotocol/sdk/inMemory.js');
const { Client } = await imp('@modelcontextprotocol/sdk/client/index.js');
const { JobStore } = await import(pathToFileURL(MCP + '/job_store.js').href);
const { WorkflowSessions } = await import(pathToFileURL(MCP + '/workflow_sessions.js').href);
const { buildWorkflowServer } = await import(pathToFileURL(MCP + '/workflow_tools.js').href);
const server = await buildWorkflowServer({ sessions: new WorkflowSessions({ store: new JobStore() }), compatibility: true });
const client = new Client({ name: 'bb8-v3', version: '1' });
const [a, b] = InMemoryTransport.createLinkedPair();
await server.connect(a); await client.connect(b);
const { tools } = await client.listTools();
for (const t of tools.filter((t) => ['lyric_check', 'lyric_revise', 'begin_lyrics', 'get_operation'].includes(t.name)))
  console.log(t.name, JSON.stringify({ req: t.inputSchema.required, props: Object.keys(t.inputSchema.properties || {}) }));
process.exit(0);

#!/usr/bin/env node
// check_rest_parity.js — the REST adapter and the MCP connector answer the same,
// and REFUSE the same.
//
// @covers: adapter-parity
//
// WHY BOTH HALVES. Proving two adapters agree on RESULTS is the obvious gate and
// the insufficient one. engine.js validates nothing — it trusts its caller — so
// the only thing standing between a malformed argument and the renderer is the
// Zod check each adapter runs at its own edge. If REST were to drop that check,
// results parity would still pass on every well-formed request while
// `format: "RICH"` quietly rendered prose (358 chars where "rich" gives 998) and
// `max_chars: -1` returned 26. That is the same shape as the bug where the
// compact format silently dropped the room the user asked for: a confident wrong
// answer, no error. So this gate asserts REJECTION parity too — a request one
// adapter refuses, the other must refuse.
//
// The third assertion has nothing to do with adapters. The REST edit grammar uses
// ';' and '=' as delimiters, which is only safe because no catalog id contains a
// URL delimiter. That is a measured property of today's data, not a law, so it is
// re-measured here against the live catalog: the day someone mints an id with a
// comma in it, this fails loudly instead of the URLs failing quietly.
//
// AND THE LAST SECTION IS ABOUT HEADERS, which is why it is the only part of this
// file that opens a socket. mountRest's crawl declarations are invisible from a
// handler's return value: whether `/` carries X-Robots-Tag, whether /robots.txt is
// served as text/plain, and whether the catch-all shadows a route the entry point
// registers AFTER mountRest are properties of the express stack, not of
// handleRecipe. So that section builds a real express app on port 0 and asks it
// over real HTTP.
//
// It exists because of a defect this repo shipped: one unconditional
// res.set('X-Robots-Tag', 'noindex') inside the shared send() wrapper, which
// applied to the teaching index and every catalog page as well as to the edit
// surface it was written for. That is not a cosmetic cost. OpenAI checks whether
// an address has been seen by an independent public web index before it will
// auto-load it, so a host nobody is permitted to crawl is a host models are not
// permitted to follow our own links to — we were handing models URLs and
// simultaneously asking the world not to look at them. Both directions are
// asserted, because a gate that checked only one would have passed on the original
// defect (teaching surface noindexed) or on its overcorrection (edit surface, a
// transcription of what a user said they wanted sitting in an address, indexed).
//
// Usage: node scripts/check_rest_parity.js [--verbose]
// Exit 0 if every pair agrees, 1 otherwise.

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');

// The adapters are ES modules; run the comparison in one child so both load once.
const script = `
import { createServer, request } from 'node:http';
import { createRequire } from 'node:module';
import * as E from '${path.join(ROOT, 'mcp', 'engine.js')}';
import { TOOL_SCHEMAS } from '${path.join(ROOT, 'mcp', 'schemas.js')}';
import { handleRecipe, handleCatalog, handleRecord, parseEdit, formatEdit, mountRest, RestError } from '${path.join(ROOT, 'mcp', 'rest.js')}';
import { buildOpenApi } from '${path.join(ROOT, 'mcp', 'openapi.js')}';
import C from '${path.join(ROOT, 'scripts', '_loader.js')}';

const req = { headers: { host: 'x' }, protocol: 'http', originalUrl: '/', query: {} };
const results = { pass: 0, fail: 0, notes: [] };
const fail = (what, detail) => { results.fail++; results.notes.push('FAIL ' + what + ' :: ' + detail); };
const pass = (what) => { results.pass++; if (${VERBOSE}) results.notes.push('ok   ' + what); };

// ── 1. RESULTS PARITY ────────────────────────────────────────────────────────
// Same request through both adapters must produce the same recipe string.
const CASES = [
  { t: ['delta_blues'], e: [] },
  { t: ['country'], e: ['set_preface;card=voice;preface=worn'] },
  { t: ['country'], e: ['set_preface;card=voice;preface=worn', 'set_environment;card=voice;room=carpeted_bedroom'] },
  { t: ['afrobeat'], e: ['add_instrument;instrument=trumpet'] },
  { t: ['detroit_techno','industrial'], e: ['set_preface;card=voice;preface=bitter'] },
  { t: ['gagaku'], e: ['set_environment;card=voice;tuning=twelve_tet'] },
  { t: ['qawwali'], e: ['remove_instrument;card=voice'] },
  { t: ['fado'], e: ['add_tradition;tradition=chanson_classique'] },
];
// Compare OUTCOMES, not just successes. A case both adapters refuse is agreement
// and must be asserted as such — bailing out when REST throws would silently
// shrink the gate to whatever happens to succeed, which is how a parity check
// ends up proving nothing. (Some fixtures deliberately reference a card the
// tradition does not have: gagaku and qawwali carry no \`voice\` card.)
const outcome = (fn) => {
  try { return { ok: true, value: fn() }; }
  catch (err) { return { ok: false, error: (err && err.message) || String(err) }; }
};
for (const fmt of ['rich', 'tags', 'prose', 'compact']) {
  for (const c of CASES) {
    const label = 'results ' + fmt + ' ' + c.t.join('+') + ' [' + c.e.length + ' edits]';
    const rest = outcome(() =>
      handleRecipe({ ...req, query: {} }, { traditions: c.t.join(','), edit: c.e, format: fmt }).recipe);
    const mcp = outcome(() => {
      const seed = E.startRecipe({ traditions: c.t, format: fmt });
      return c.e.length === 0 ? seed.recipe
        : E.editRecipe({ workspace: seed.workspace, edits: c.e.map((s, i) => parseEdit(s, i)), format: fmt }).recipe;
    });
    if (rest.ok !== mcp.ok) {
      fail(label, 'REST ' + (rest.ok ? 'succeeded' : 'threw') + ' but MCP ' + (mcp.ok ? 'succeeded' : 'threw') +
        ' :: ' + (rest.error || mcp.error));
    } else if (!rest.ok) {
      // Both refused. The MESSAGES must match too, or one adapter is explaining
      // a different problem than the other for the same input.
      if (rest.error === mcp.error) pass(label + ' (both refuse, same reason)');
      else fail(label, 'both refused but differently: REST "' + rest.error + '" vs MCP "' + mcp.error + '"');
    } else if (rest.value === mcp.value) pass(label);
    else fail(label, 'REST ' + rest.value.length + ' chars != MCP ' + mcp.value.length + ' chars');
  }
}

// ── 2. REJECTION PARITY ──────────────────────────────────────────────────────
// A value one adapter refuses, the other must refuse. These are exactly the
// inputs engine.js accepts and mis-renders when nothing validates.
const BAD = [
  { tool: 'start_recipe', args: { traditions: ['country'], format: 'RICH' },   q: { traditions: 'country', format: 'RICH' } },
  { tool: 'start_recipe', args: { traditions: ['country'], format: 'bogus' },  q: { traditions: 'country', format: 'bogus' } },
  { tool: 'start_recipe', args: { traditions: ['country'], format: '' },       q: { traditions: 'country', format: '' } },
  { tool: 'start_recipe', args: { traditions: ['country'], max_chars: 0 },     q: { traditions: 'country', max_chars: '0' } },
  { tool: 'start_recipe', args: { traditions: ['country'], max_chars: -1 },    q: { traditions: 'country', max_chars: '-1' } },
  { tool: 'start_recipe', args: { traditions: ['country'], max_chars: 99999 }, q: { traditions: 'country', max_chars: '99999' } },
  { tool: 'start_recipe', args: { traditions: [] },                            q: { traditions: '' } },
];
for (const b of BAD) {
  const label = 'rejection ' + JSON.stringify(b.q);
  const mcpRejects = !TOOL_SCHEMAS[b.tool].safeParse(b.args).success;
  let restRejects = false;
  try { handleRecipe({ ...req, query: b.q }, b.q); } catch { restRejects = true; }
  if (mcpRejects === restRejects && mcpRejects) pass(label);
  else if (mcpRejects !== restRejects)
    fail(label, 'MCP ' + (mcpRejects ? 'rejects' : 'ACCEPTS') + ' but REST ' + (restRejects ? 'rejects' : 'ACCEPTS'));
  else fail(label, 'neither adapter rejected it — engine.js would render it silently');
}

// ── 3. THE DELIMITER PRECONDITION ────────────────────────────────────────────
// The edit grammar is only unambiguous while no id contains a URL delimiter.
const ids = new Set();
const add = (x) => { if (typeof x === 'string' && x) ids.add(x); };
for (const t of C.TRADITIONS || []) add(t.id);
for (const i of C.INSTRUMENTS || []) { add(i.id);
  for (const p of i.parts || []) { add(p.id); for (const v of p.variants || []) add(v.id); } }
for (const r of C.ROOMS || []) add(r.id);
for (const t of C.TUNINGS || []) add(t.id);
for (const p of C.PREFACE_LEXICON || []) add(p.id);
for (const s of C.CHAIN_SECTIONS || []) { add(s.id); add(s.stage); for (const it of s.items || []) add(it.id); }
for (const a of C.ARRANGEMENTS || []) add(a.id);
for (const a of C.PRODUCTION_AESTHETICS || []) add(a.id);
for (const a of C.CHAIN_ARCHETYPES || []) add(a.id);
const offenders = [...ids].filter((id) => /[;,=&?#+%\\s]/.test(id));
if (offenders.length === 0) pass('delimiter precondition (' + ids.size + ' ids clean)');
else fail('delimiter precondition',
  offenders.length + ' id(s) contain a URL delimiter and would break the edit grammar: ' + offenders.slice(0, 5).join(', '));

// ── 4. ROUND TRIP ────────────────────────────────────────────────────────────
// Anything the parser accepts must re-serialise to something the parser accepts
// and that means the same thing — otherwise the canonical URL in \`self\` is a lie.
const FORMS = [
  'set_preface;card=voice;preface=worn',
  'set_preface,card=voice,preface=worn',
  'set_variant;card=pedal_steel;part=pedal_steel_strings;variant=nickel_wound',
  'set_environment;card=voice;room=carpeted_bedroom;chain.mic=sm57',
  'add_instrument;instrument=trumpet;tradition=afrobeat',
];
// Compare CONTENT, not key order. formatEdit emits a fixed field order so the
// canonical URL is stable; parseEdit records fields in encounter order. Those
// differ as objects and are identical as edits, which is what matters.
const norm = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))));
for (const f of FORMS) {
  const once = parseEdit(f, 0);
  const twice = parseEdit(formatEdit(once), 0);
  if (norm(once) === norm(twice)) pass('round trip ' + f.slice(0, 40));
  else fail('round trip ' + f, norm(once) + ' != ' + norm(twice));
}

// ── 5. DISCOVERY SURFACES RESOLVE ────────────────────────────────────────────
try {
  const cat = handleCatalog({ ...req, query: {} }, { q: 'country', type: 'tradition' });
  if ((cat.items || []).length > 0) pass('catalog search returns items'); else fail('catalog search', 'no items');
  const rec = handleRecord({ ...req, query: {} }, 'instrument', 'voice');
  if ((rec.parts || []).length > 0) pass('record lookup returns parts'); else fail('record lookup', 'no parts');
} catch (err) { fail('discovery', err.message); }

// ── 6. THE CRAWLABLE SURFACE ─────────────────────────────────────────────────
// Real sockets from here down. express is resolved the way server_http.js
// resolves it — off mcp/, which is where its node_modules lives — rather than off
// this script's own directory, so the gate exercises the same express the host
// runs. jsdom comes from the repo root, where every other gate's parser lives.
const requireFromMcp = createRequire('${path.join(ROOT, 'mcp', 'rest.js')}');
const requireFromRoot = createRequire('${path.join(ROOT, 'scripts', 'check_rest_parity.js')}');
const express = requireFromMcp('express');
const { JSDOM } = requireFromRoot('jsdom');

const app = express();
app.use(express.json());
mountRest(app, { openapi: buildOpenApi });
// Registered AFTER mountRest, exactly as server_http.js registers /health,
// /.well-known/mcp.json and the /mcp transport after its own mountRest call. See
// the shadowing assertions at the end of this section for what it is for.
app.get('/health', (_q, r) => r.json({ ok: true, sentinel: 'post-mount' }));

const server = createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const ORIGIN = 'http://127.0.0.1:' + PORT;

// agent: false so each request gets its own socket and closes it. The default
// global agent keeps sockets alive, which would leave server.close() waiting on
// them and turn a finished gate into a gate that hangs.
const hit = (target, opts) => new Promise((resolve, reject) => {
  const o = opts || {};
  const payload = o.body == null ? null : JSON.stringify(o.body);
  const headers = { ...(o.headers || {}) };
  if (payload) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = Buffer.byteLength(payload);
  }
  const r = request({
    host: '127.0.0.1', port: PORT, path: target, method: o.method || 'GET', agent: false, headers,
  }, (res) => {
    let b = '';
    res.setEncoding('utf8');
    res.on('data', (c) => { b += c; });
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
  });
  r.on('error', reject);
  if (payload) r.write(payload);
  r.end();
});
const ctype = (res) => String(res.headers['content-type'] || '');
const robotsTag = (res) => res.headers['x-robots-tag'];

// ── 6a. INDEXABILITY, both directions ────────────────────────────────────────
// The teaching surface. If any of these carries noindex again, the one document
// that explains this API is telling every crawler to skip it, and our own
// addresses stay out of the index that decides whether a model may auto-load
// them. /openapi.json is listed even though it does not go through send(): the
// point of the assertion is the surface, not the wrapper, and the day someone
// moves it under send() this keeps holding.
const INDEXABLE = [
  '/',
  '/v1',
  '/openapi.json',
  '/openapi-3.0.json',
  '/robots.txt',
  '/sitemap.xml',
  '/v1/catalog?type=tradition',
  '/v1/catalog/tradition/delta_blues',
  '/v1/recipe?traditions=country',
];
for (const u of INDEXABLE) {
  const res = await hit(u);
  const label = 'indexable ' + u;
  if (res.status !== 200) fail(label, 'expected 200, got ' + res.status + ' :: ' + res.body.slice(0, 200));
  else if (robotsTag(res) != null)
    fail(label, 'carries X-Robots-Tag: ' + robotsTag(res) +
      ' — the teaching surface is telling crawlers to skip it, which is the defect this section exists for');
  else pass(label);
}

// The edit surface, and the other half of the same gate. A URL carrying edit= is
// a transcription of something a person said they wanted, in the address itself.
// Every alias handleRecipe accepts is checked, and so is the POST body — a POST
// answer's \`self\` link spells the edits back out as a URL, so deciding on the
// query string alone would leak exactly the same words.
const EDIT = 'set_preface;card=voice;preface=worn';
const NOINDEXED = [
  ['GET', '/v1/recipe?traditions=country&edit=' + EDIT, null],
  ['GET', '/v1/recipe?traditions=country&edits=' + EDIT, null],
  ['GET', '/v1/recipe?traditions=country&e=' + EDIT, null],
  ['POST', '/v1/recipe', { traditions: ['country'], edits: [EDIT] }],
];
for (const [method, u, body] of NOINDEXED) {
  const res = await hit(u, { method, body });
  const label = 'noindex ' + method + ' ' + u.slice(0, 44);
  if (res.status !== 200) fail(label, 'expected 200, got ' + res.status + ' :: ' + res.body.slice(0, 200));
  else if (!/noindex/.test(String(robotsTag(res) || '')))
    fail(label, 'edit surface carries no X-Robots-Tag: noindex — the user\\'s own words are indexable');
  else pass(label);
}
// The control for the POST case: same route, same body shape, no edits. Without
// it "POST is noindexed" would also be satisfied by a blanket header on POST.
{
  const res = await hit('/v1/recipe', { method: 'POST', body: { traditions: ['country'] } });
  const label = 'indexable POST /v1/recipe (seed, no edits)';
  if (res.status !== 200) fail(label, 'expected 200, got ' + res.status + ' :: ' + res.body.slice(0, 200));
  else if (robotsTag(res) != null) fail(label, 'carries X-Robots-Tag: ' + robotsTag(res));
  else pass(label);
}

// ── 6b. /robots.txt ──────────────────────────────────────────────────────────
const robots = await hit('/robots.txt');
if (robots.status === 200 && ctype(robots).startsWith('text/plain')) pass('robots.txt served as text/plain');
else fail('robots.txt served as text/plain', 'status ' + robots.status + ', content-type ' + ctype(robots));
if (robots.body.trim().length > 0) pass('robots.txt is non-empty');
else fail('robots.txt is non-empty', 'zero-length body');

// robots.txt is parsed rather than string-matched, because the interesting claims
// are about what it PERMITS, and "contains the string OAI-SearchBot" is satisfied
// by a comment. Groups are not additive — a crawler obeys only the most specific
// group naming it — so OAI-SearchBot having its own group means that group has to
// carry every rule itself, and the only way to check that is to run the rules.
function parseRobots(txt) {
  const groups = [];
  let cur = null;
  let naming = false;
  for (const rawLine of txt.split('\\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const field = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (field === 'user-agent') {
      if (!naming) { cur = { agents: [], rules: [] }; groups.push(cur); naming = true; }
      cur.agents.push(value.toLowerCase());
      continue;
    }
    if ((field === 'allow' || field === 'disallow') && cur) {
      naming = false;
      cur.rules.push({ allow: field === 'allow', pattern: value });
    }
  }
  return groups;
}
// Each literal character is wrapped in its own character class so no
// metacharacter in a rule can change the meaning of the pattern; '*' is the one
// wildcard robots.txt defines. '$' is NOT given its end-anchor meaning here, and
// that under-approximation is safe in the direction that matters: treating it as
// a literal can only make a rule match FEWER urls, so a Disallow that this gate
// reports as matching really does match, and a Disallow this gate misses turns
// into a failed assertion rather than a false green.
const CLASS_ESCAPE = new Set([']', '^', '-', '\\\\']);
function ruleRe(pattern) {
  let out = '^';
  for (const ch of pattern) {
    if (ch === '*') { out += '.*'; continue; }
    out += '[' + (CLASS_ESCAPE.has(ch) ? '\\\\' : '') + ch + ']';
  }
  return new RegExp(out);
}
// Longest match wins; Allow wins a tie. That is the rule that makes 'Allow: /'
// plus a handful of parameter-keyed Disallows mean what it is meant to mean.
function robotsAllows(groups, agent, pathAndQuery) {
  const a = agent.toLowerCase();
  const group = groups.find((g) => g.agents.includes(a)) || groups.find((g) => g.agents.includes('*'));
  if (!group) return true;
  let best = null;
  for (const r of group.rules) {
    if (!ruleRe(r.pattern).test(pathAndQuery)) continue;
    if (!best || r.pattern.length > best.pattern.length ||
        (r.pattern.length === best.pattern.length && r.allow && !best.allow)) best = r;
  }
  return best ? best.allow : true;
}

const groups = parseRobots(robots.body);
for (const agent of ['OAI-SearchBot', '*']) {
  const g = groups.find((x) => x.agents.includes(agent.toLowerCase()));
  if (!g) { fail('robots.txt names ' + agent, 'no User-agent group for it'); continue; }
  if (g.rules.length === 0) { fail('robots.txt names ' + agent, 'group is empty — it grants and forbids nothing'); continue; }
  pass('robots.txt names ' + agent + ' (' + g.rules.length + ' rules)');
}
// The rules themselves, run. Without these the group check above is satisfied by
// a User-agent line with 'Allow: /' under it and nothing else.
const CRAWLABLE = ['/', '/openapi.json', '/sitemap.xml', '/v1/catalog?type=tradition', '/v1/recipe?traditions=country'];
const OFF_LIMITS = [
  '/v1/recipe?traditions=country&edit=' + EDIT,
  '/v1/recipe?traditions=country&edits=' + EDIT,
  '/v1/recipe?traditions=country&e=' + EDIT,
];
for (const agent of ['OAI-SearchBot', '*']) {
  // /v1/catalog?type=tradition is in CRAWLABLE deliberately: 'type=' ends in the
  // literal 'e=', so an unanchored Disallow on the 'e' alias silently forbids the
  // entire catalog. This is the assertion that catches that.
  const wrongly = CRAWLABLE.filter((u) => !robotsAllows(groups, agent, u));
  const leaked = OFF_LIMITS.filter((u) => robotsAllows(groups, agent, u));
  const label = 'robots.txt rules for ' + agent;
  if (wrongly.length) fail(label, 'forbids the teaching surface: ' + wrongly.join(' , '));
  else if (leaked.length) fail(label, 'permits the edit surface: ' + leaked.join(' , '));
  else pass(label + ' (' + CRAWLABLE.length + ' allowed, ' + OFF_LIMITS.length + ' disallowed)');
}
// The Sitemap line is followed rather than matched, so a reference to a document
// that is not there fails here instead of at a crawler.
const smLine = robots.body.split('\\n').map((l) => l.trim()).find((l) => /^sitemap:/i.test(l));
if (!smLine) fail('robots.txt references the sitemap', 'no Sitemap: line');
else {
  const smUrl = smLine.slice(smLine.indexOf(':') + 1).trim();
  if (!smUrl.startsWith(ORIGIN + '/'))
    fail('robots.txt references the sitemap', 'Sitemap: names ' + smUrl + ', not a URL on the origin that served it (' + ORIGIN + ')');
  else {
    const probe = await hit(smUrl.slice(ORIGIN.length));
    if (probe.status === 200) pass('robots.txt references the sitemap and it resolves (' + smUrl.slice(ORIGIN.length) + ')');
    else fail('robots.txt references the sitemap', smUrl + ' returned ' + probe.status);
  }
}

// ── 6c. /sitemap.xml ─────────────────────────────────────────────────────────
const sitemap = await hit('/sitemap.xml');
if (sitemap.status === 200 && /xml/.test(ctype(sitemap))) pass('sitemap.xml served as XML');
else fail('sitemap.xml served as XML', 'status ' + sitemap.status + ', content-type ' + ctype(sitemap));

// A real XML parser, not a regex. The failure this guards is an unescaped '&' or
// '<' reaching a <loc>, which a regex that goes looking for <loc> would sail past
// and a parser refuses outright. The catalog half of every URL is proven free of
// both by the delimiter precondition above; the ORIGIN half is a caller-supplied
// Host header and carries no such guarantee.
let sitemapDoc = null;
try {
  sitemapDoc = new JSDOM(sitemap.body, { contentType: 'application/xml' }).window.document;
  pass('sitemap.xml is well-formed XML');
} catch (err) {
  fail('sitemap.xml is well-formed XML', 'parser refused it: ' + ((err && err.message) || String(err)));
}
// The same document, requested under a Host header full of XML metacharacters.
// The catalog half of every <loc> is proven clean by the delimiter precondition
// above, so a normal request would keep passing with the escaping deleted — the
// only caller-controlled input in this document is the ORIGIN, and it arrives on
// a header. Without this, "sitemap.xml is well-formed XML" is a check that cannot
// fail for the one reason it was written.
{
  const hostile = await hit('/sitemap.xml', { headers: { host: 'a&b<c".example' } });
  const label = 'sitemap.xml survives a hostile Host header';
  if (hostile.status !== 200) fail(label, 'status ' + hostile.status);
  else {
    try {
      new JSDOM(hostile.body, { contentType: 'application/xml' });
      pass(label);
    } catch (err) {
      fail(label, 'served malformed XML: ' + ((err && err.message) || String(err)) +
        ' — the origin half of every <loc> is caller-supplied and is not being escaped');
    }
  }
}

const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
if (sitemapDoc) {
  const root = sitemapDoc.documentElement;
  if (root.tagName === 'urlset' && root.namespaceURI === SITEMAP_NS) pass('sitemap.xml root is a sitemaps.org urlset');
  else fail('sitemap.xml root is a sitemaps.org urlset', 'got <' + root.tagName + '> in ns ' + root.namespaceURI);
}

const locs = sitemapDoc ? [...sitemapDoc.getElementsByTagName('loc')].map((n) => n.textContent) : [];
// The floor is the live catalog, never a number typed into this file: a hardcoded
// count goes stale on the first tradition added and a truncated sitemap is worse
// than a missing one, because 50 of 1167 traditions is indistinguishable from a
// complete document. listTraditions pages at 50 by default, which is exactly how
// that would happen.
const tradIds = E.listTraditions({ limit: E.counts.traditions }).items.map((t) => t.id);
// Decode rather than re-encode: comparing against a second copy of rest.js's
// encoder would prove the two copies agree, not that the sitemap points at real
// traditions. Round-tripping through decodeURIComponent proves both.
const seeded = new Set();
for (const loc of locs) {
  const m = loc.match(/^.*\\/v1\\/recipe\\?traditions=([^&]+)$/);
  if (!m) continue;
  try { seeded.add(decodeURIComponent(m[1])); } catch { seeded.add(m[1]); }
}
const missing = tradIds.filter((id) => !seeded.has(id));
if (tradIds.length === 0) fail('sitemap covers every tradition', 'the catalog reported zero traditions');
else if (missing.length === 0) pass('sitemap covers every tradition (' + tradIds.length + ' of ' + E.counts.traditions + ')');
else fail('sitemap covers every tradition',
  missing.length + ' of ' + tradIds.length + ' missing, e.g. ' + missing.slice(0, 5).join(', '));

if (locs.includes(ORIGIN + '/')) pass('sitemap lists the teaching index');
else fail('sitemap lists the teaching index', ORIGIN + '/ is not among the ' + locs.length + ' entries');

if (locs.length >= tradIds.length + 1) pass('sitemap entry count (' + locs.length + ' >= ' + (tradIds.length + 1) + ')');
else fail('sitemap entry count', locs.length + ' entries is below the live floor of ' + (tradIds.length + 1) + ' (every tradition plus the index)');

const dupes = locs.filter((u, i) => locs.indexOf(u) !== i);
if (dupes.length === 0) pass('sitemap has no duplicate <loc>');
else fail('sitemap has no duplicate <loc>', dupes.length + ' repeat(s), e.g. ' + dupes[0]);

// The two documents have to agree with each other. A sitemap that advertises a
// URL robots.txt forbids is the API asking a crawler to do something and telling
// it not to in the same breath — and the concrete way that happens here is an
// edited recipe getting into the sitemap.
const contradictions = locs.filter((u) => u.startsWith(ORIGIN) && !robotsAllows(groups, '*', u.slice(ORIGIN.length)));
if (contradictions.length === 0) pass('sitemap advertises nothing robots.txt forbids');
else fail('sitemap advertises nothing robots.txt forbids',
  contradictions.length + ' entr(ies) are Disallowed, e.g. ' + contradictions[0]);

// Three entries are actually fetched. A sitemap of well-formed URLs that 404 is
// well-formed and useless, and the sampling is deterministic so a failure is
// reproducible.
for (const i of [0, Math.floor(locs.length / 2), locs.length - 1]) {
  const loc = locs[i];
  if (!loc || !loc.startsWith(ORIGIN)) { fail('sitemap entry ' + i + ' resolves', 'no entry at index ' + i); continue; }
  const res = await hit(loc.slice(ORIGIN.length));
  const label = 'sitemap entry ' + i + ' resolves (' + loc.slice(ORIGIN.length).slice(0, 44) + ')';
  if (res.status !== 200) fail(label, 'returned ' + res.status);
  else if (robotsTag(res) != null) fail(label, 'resolves but carries X-Robots-Tag: ' + robotsTag(res) + ' — advertised and noindexed at once');
  else pass(label);
}

// ── 6d. THE CATCH-ALL ────────────────────────────────────────────────────────
// A caller that guessed a path wrong must end up taught, not stuck. Before the
// catch-all existed '/v1/recipes' — one plausible plural — fell through to
// express's bare HTML 404 and a model got back no grammar at all, from the one
// server whose whole premise is that it teaches its own grammar on any hop.
const index = JSON.parse((await hit('/')).body);
for (const u of ['/nonsense', '/v1/recipes']) {
  const res = await hit(u);
  const label = 'catch-all teaches at ' + u;
  if (res.status !== 404) {
    // Not 200 either: a host that answers 200 everywhere is a soft-404, telling a
    // crawler that every typo anyone makes is as real a page as the 1167 in the
    // sitemap.
    fail(label, 'expected 404, got ' + res.status);
    continue;
  }
  if (!ctype(res).includes('json') || /Cannot GET/.test(res.body)) {
    fail(label, 'bare express 404 — content-type ' + ctype(res) + ', body ' + res.body.slice(0, 120));
    continue;
  }
  let body;
  try { body = JSON.parse(res.body); } catch { fail(label, 'body is not JSON: ' + res.body.slice(0, 120)); continue; }
  const e = body.error || {};
  // Compared against the INDEX's own table rather than a list retyped here. The
  // endpoint table was hoisted so the 404 and the index cannot drift; that is
  // only true while something checks it, and two copies of a table drift the
  // first time a query parameter is added to one of them.
  if (JSON.stringify(e.endpoints) !== JSON.stringify(index.endpoints)) {
    fail(label, 'endpoint table differs from the index document — the 404 and / have drifted');
    continue;
  }
  if (!String(e.start_here || '').startsWith(ORIGIN + '/v1/recipe') || !String(e.resolve_a_word || '').startsWith(ORIGIN + '/v1/catalog')) {
    fail(label, 'names no runnable next hop: start_here=' + e.start_here + ' resolve_a_word=' + e.resolve_a_word);
    continue;
  }
  pass(label + ' (404 + the index endpoint table + a next hop)');
}

// The catch-all must not eat anything real. mountRest defers registering it to a
// process.nextTick callback for exactly this reason, and that ordering is
// invisible from outside except by asking. /health stands in for what
// server_http.js registers after its mountRest call — /.well-known/mcp.json and
// the /mcp transport itself. Make the catch-all synchronous and this is the
// assertion that goes red; in production the symptom is the MCP connector
// answering initialize with a helpful JSON 404 that reads like a working
// endpoint in a log.
{
  const res = await hit('/health');
  let ok = false;
  try { ok = res.status === 200 && JSON.parse(res.body).sentinel === 'post-mount'; } catch { ok = false; }
  if (ok) pass('catch-all does not shadow a route registered after mountRest');
  else fail('catch-all does not shadow a route registered after mountRest',
    '/health returned ' + res.status + ' :: ' + res.body.slice(0, 160) +
    ' — every route the entry point registers under mountRest, including POST /mcp, is dark');
}
for (const [u, prefix] of [['/robots.txt', 'text/plain'], ['/sitemap.xml', 'application/xml']]) {
  const res = await hit(u);
  const label = 'catch-all does not shadow ' + u;
  if (res.status === 200 && ctype(res).startsWith(prefix)) pass(label);
  else fail(label, 'status ' + res.status + ', content-type ' + ctype(res) + ' (expected ' + prefix + ')');
}
{
  const res = await hit('/start_recipe?traditions=country');
  const label = 'catch-all does not shadow the tool-name aliases';
  if (res.status === 308 && String(res.headers.location || '').startsWith('/v1/recipe')) pass(label);
  else fail(label, 'expected 308 to /v1/recipe, got ' + res.status + ' -> ' + res.headers.location);
}

server.close();

console.log(JSON.stringify(results));
`;

let out;
try {
  out = execFileSync('node', ['--input-type=module', '-e', script], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
} catch (e) {
  console.error('=== REST/MCP adapter parity ===');
  console.error(
    'FAIL — the comparison harness itself did not run:\n' + (e.stdout || '') + (e.stderr || '')
  );
  process.exit(1);
}

const line = out.trim().split('\n').pop();
const results = JSON.parse(line);

console.log('=== REST/MCP adapter parity ===');
for (const n of results.notes) console.log('  ' + n);
console.log(`  ${results.pass} assertion(s) passed, ${results.fail} failed`);

// Refuse to pass vacuously: a harness that asserted nothing would otherwise mint
// a green result, which is exactly the failure class this repo keeps finding.
if (results.pass === 0) {
  console.error('FAIL — no assertions ran; refusing to pass vacuously');
  process.exit(1);
}
if (results.fail > 0) {
  console.error('FAIL — see the assertion(s) above. A parity failure means one adapter is');
  console.error('       validating or dispatching differently from the other, even though they');
  console.error('       share engine.js and TOOL_SCHEMAS. A crawl-surface failure means the');
  console.error('       host is declaring itself wrong to the index that decides whether a');
  console.error('       model is allowed to follow the URLs we hand it.');
  process.exit(1);
}
console.log('PASS — both adapters agree on what they answer AND on what they refuse, and the');
console.log('       crawl surface declares the teaching half public and the edit half not.');
process.exit(0);

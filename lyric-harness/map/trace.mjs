// Runs the reference song (map/song.txt) through every lyric tool, the way an
// MCP client calls them, and writes map/trace.json. map/build.py reads it.
//
//   node lyric-harness/map/trace.mjs            timings (warm worker, as deployed)
//   node lyric-harness/map/trace.mjs --profile  also profile each harness process
//
// --profile runs every call in its own Python process (LYRIC_WORKER=0) with a
// profiling hook on PYTHONPATH, so each call leaves one cProfile file in map/.prof/.
// Revise questions are answered mechanically: each asked line gets the first
// word its brief offers as a new end word (or stays as it was).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MAP = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(MAP, '..', '..');
const MCP = path.join(ROOT, 'mcp');
const PROFILE = process.argv.includes('--profile');
const PROF_DIR = path.join(MAP, '.prof');
const SITECUSTOMIZE = `"""Profile one harness process for map/build.py's trace. Inert unless
SONG_MAP_PROFILE names a directory; map/trace.mjs writes this file and
puts its folder on PYTHONPATH only for the profiled run. Also records which harness files the
process opened, so the map can say what the song program reads."""
import os

_DIR = os.environ.get("SONG_MAP_PROFILE")
if _DIR:
    import atexit
    import cProfile
    import sys

    _HARNESS = os.environ["SONG_MAP_HARNESS"]
    _opened = set()

    def _audit(event, args):
        if event == "open" and args and isinstance(args[0], str):
            path = os.path.abspath(args[0])
            if path.startswith(_HARNESS + os.sep):
                _opened.add(os.path.relpath(path, _HARNESS))

    sys.addaudithook(_audit)
    _prof = cProfile.Profile()
    _prof.enable()

    def _dump():
        _prof.disable()
        verb = sys.argv[1] if len(sys.argv) > 1 else "none"
        base = os.path.join(_DIR, f"{os.environ.get('SONG_MAP_CALL', 'call')}--{verb}--{os.getpid()}")
        _prof.dump_stats(base + ".prof")
        with open(base + ".opened", "w", encoding="utf-8") as fh:
            fh.write("\\n".join(sorted(_opened)) + "\\n")

    atexit.register(_dump)
`;
if (PROFILE) {
  fs.rmSync(PROF_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROF_DIR);
  process.env.LYRIC_WORKER = '0';
  process.env.SONG_MAP_PROFILE = PROF_DIR;
  process.env.SONG_MAP_HARNESS = path.dirname(MAP);
  // The profiling hook is written fresh for each run into the ignored .prof/
  // folder; Python loads it from PYTHONPATH as sitecustomize at start-up.
  const hook = path.join(PROF_DIR, 'hook');
  fs.mkdirSync(hook);
  fs.writeFileSync(path.join(hook, 'sitecustomize.py'), SITECUSTOMIZE);
  process.env.PYTHONPATH = process.env.PYTHONPATH
    ? `${hook}${path.delimiter}${process.env.PYTHONPATH}`
    : hook;
}
const req = createRequire(path.join(MCP, 'package.json'));
const load = (spec) => import(pathToFileURL(req.resolve(spec)).href);
const { Client } = await load('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = await load('@modelcontextprotocol/sdk/inMemory.js');
const { buildServer } = await import(pathToFileURL(path.join(MCP, 'tools.js')).href);
const { TOOL_BUDGET_MS } = await import(pathToFileURL(path.join(MCP, 'budget.js')).href);

const server = buildServer({ task: { domain: 'lyrics' } });
const client = new Client({ name: 'song-map', version: '1' }, { capabilities: {} });
const [a, b] = InMemoryTransport.createLinkedPair();
await Promise.all([client.connect(a), server.connect(b)]);

const song = fs
  .readFileSync(path.join(MAP, 'song.txt'), 'utf8')
  .split('\n')
  .filter((l) => l.trim());
const LINES = song.length;
const SCHEME = 'AABBCCDDEEFFGGHH'.slice(0, LINES);
const ends = song.map((l) =>
  l
    .replace(/[^A-Za-z' ]/g, '')
    .trim()
    .split(/\s+/)
    .pop()
    .toLowerCase()
);
const calls = [];
let n = 0;

function verdictOf(text) {
  let v = null;
  for (const blk of text.split('\n\u0000\n')) {
    try {
      const j = JSON.parse(blk);
      if (j && typeof j === 'object' && 'exit_code' in j) v = j;
    } catch {}
  }
  return v;
}

async function call(flow, name, args) {
  n += 1;
  process.env.SONG_MAP_CALL = String(n).padStart(2, '0');
  const t = Date.now();
  let text;
  try {
    const r = await client.callTool({ name, arguments: args }, undefined, {
      timeout: TOOL_BUDGET_MS + 60000,
    });
    text = (r.content || []).map((c) => c.text).join('\n\u0000\n');
  } catch (e) {
    text = `CALL ERROR ${e.message}`;
  }
  const v = verdictOf(text);
  const rec = {
    n,
    flow,
    tool: name,
    ms: Date.now() - t,
    exit_code: v?.exit_code ?? null,
    status: v?.status ?? null,
    meaning: v?.meaning ?? null,
    refusal: v?.refusal ? String(v.refusal).slice(0, 300) : null,
    asked: v?.asked ?? null,
    stop: text.match(/\[FINISHED[^\]]*\]|\[STOPPED[^\]]*\]/)?.[0] ?? null,
    error: v ? null : text.slice(0, 200),
  };
  calls.push(rec);
  console.log(
    `${String(n).padStart(2)} ${flow.padEnd(7)} ${name.padEnd(13)} ${(rec.ms / 1000).toFixed(1).padStart(7)}s exit=${rec.exit_code} ${rec.status ?? ''} ${rec.stop ?? ''}`
  );
  return { text, v };
}

// One answer per asked line: swap the end word for the first word the brief offers.
function answersFor(text, v, draft) {
  const asked = v?.asked;
  let lines = asked?.lines ?? asked?.members ?? (asked?.line ? [asked.line] : null);
  const q = text.split('\n\u0000\n')[0];
  if (!lines) {
    const m = q.match(/Return exactly these lines[^:]*:\s*([^\n]+)/);
    lines = m ? [...m[1].matchAll(/L(\d+)/g)].map((x) => Number(x[1])) : [];
  }
  const offered = {};
  for (const [, line, body] of q.matchAll(
    /════════ L(\d+) ════════([\s\S]*?)(?=════════ L\d+ ════════|$)/g
  )) {
    const m = body.match(/field_band='grader'\n\s+([^\n]+)/);
    if (m) offered[Number(line)] = m[1].split(',')[0].trim();
  }
  return lines.map((line) => {
    const cur = draft[line - 1] ?? '';
    const w = offered[line];
    return { line, text: w ? cur.replace(/[A-Za-z']+([^A-Za-z']*)$/, `${w}$1`) : cur };
  });
}

async function reviseLoop(flow, first) {
  let draft = [...song];
  let { text, v } = await call(flow, 'lyric_revise', first);
  for (let k = 0; k < 8 && v?.status === 'awaiting_proposal'; k++) {
    const answers = answersFor(text, v, draft);
    if (!answers.length) break;
    for (const ans of answers) draft[ans.line - 1] = ans.text;
    ({ text, v } = await call(flow, 'lyric_revise', {
      run_id: v.run_id,
      run_revision: v.run_revision,
      answers,
    }));
  }
}

const t0 = Date.now();
// A new song: sweep -> screen -> plan -> write -> grade -> revise.
const sweep = await call('create', 'lyric_sweep', { seed_from: 0, count: 4, lines: LINES });
const seed = sweep.v?.accepted_shown?.[0] ?? 0;
await call('create', 'lyric_screen', { words: [...new Set(ends)].slice(0, 12) });
await call('create', 'lyric_plan', { seed, lines: LINES });
await call('create', 'lyric_grade', { seed, lines: LINES, draft: song });
await reviseLoop('create', { seed, lines: LINES, draft: song, new_run: true, max_rounds: 2 });
// Lyrics someone pasted: recover -> check -> revise -> verify.
await call('pasted', 'lyric_recover', { lines_text: song.join('\n') });
await call('pasted', 'lyric_check', { lines: song, scheme: SCHEME });
await reviseLoop('pasted', { draft: song, scheme: SCHEME, new_run: true, max_rounds: 2 });
const after = [...song];
after[LINES - 1] = 'The river owes us nothing, and it never will forget';
await call('pasted', 'lyric_verify', { before: song, after, scheme: SCHEME });
await call('lookup', 'lyric_types', { word_a: ends[0], word_b: ends[1] });

const out = {
  generated: new Date().toISOString(),
  profiled: PROFILE,
  worker: PROFILE ? 'cold' : 'warm',
  tool_budget_ms: TOOL_BUDGET_MS,
  song_lines: LINES,
  seed,
  total_ms: Date.now() - t0,
  calls,
};
fs.writeFileSync(
  path.join(MAP, PROFILE ? 'trace-profile.json' : 'trace.json'),
  JSON.stringify(out, null, 1) + '\n'
);
// The hook is a Python file nothing imports; don't leave it for the module counters to find.
if (PROFILE) fs.rmSync(path.join(PROF_DIR, 'hook'), { recursive: true, force: true });
process.exit(0);

// battery_inspect.mjs — an allowlisted projection of a battery's local record.
//
// The record under --source is private (bearer capabilities, the model's
// text, the lyric). The job log is public. This prints ONLY counts, enums,
// timings and identifier-shaped names: which turn ran how long, what each
// tool call returned, why each turn stopped, what the loop ladder reached.
// Nothing the model wrote and nothing a person wrote leaves the record.
//
// Usage: node scripts/battery_inspect.mjs --source=battery-out
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { safeSummary } from './battery_archive.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([a-z-]+)=(.+)$/.exec(a);
    if (!m) throw new Error(`unrecognised argument ${a}`);
    return [m[1], m[2]];
  })
);
if (!args.source) throw new Error('--source=DIR is required');
const ROOT = resolve(args.source);

const IDENT = /^[A-Za-z0-9_.:/-]{1,64}$/;
const ident = (v) => (typeof v === 'string' && IDENT.test(v) ? v : v == null ? null : 'other');
const num = (v) => (Number.isFinite(v) ? v : null);
const secs = (ms) => (Number.isFinite(ms) ? Math.round(ms / 100) / 10 : null);
const bool = (v) => (typeof v === 'boolean' ? v : null);
const len = (v) => (v == null ? 0 : typeof v === 'string' ? v.length : JSON.stringify(v).length);

function readJSONSafe(file) {
  try {
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  } catch {
    return { unreadable: true };
  }
}

function projectTool(c) {
  if (!c || typeof c !== 'object') return { name: 'other' };
  return {
    name: ident(c.name),
    exit_code: num(c.exit_code),
    is_error: bool(c.isError),
    not_run: bool(c.not_run),
    refused_by_connector: bool(c.refused_by_connector),
    ms: secs(c.ms),
    loop_rounds: num(c.loop_rounds),
    loop_stop_reason: ident(c.loop_stop_reason),
    loop_unresolved: num(c.loop_unresolved),
    answers_on_record: num(c.answers_on_record),
    banned_pairs: num(c.banned_pairs),
    draft_carried: bool(c.draft_carried),
    path: ident(c.path),
    verdict: ident(c.verdict),
  };
}

function projectRow(row) {
  const d = row.stopped_detail && typeof row.stopped_detail === 'object' ? row.stopped_detail : {};
  return {
    turn: num(row.turn),
    status: num(row.status),
    seconds: secs(row.ms),
    transport_failure: row.transport != null,
    stopped: ident(row.stopped),
    stopped_detail: {
      seconds: secs(d.ms),
      cap_seconds: secs(d.cap),
      hops: num(d.hops),
      max_steps: num(d.maxSteps),
      status: num(d.status),
      calls: num(d.calls),
    },
    malformed_hops: Array.isArray(row.malformed) ? row.malformed.length : null,
    user_reasks: num(row.user_reasks),
    upstream_status: num(row.upstream_status),
    hops_before_failure: num(row.hops_before_failure),
    calls_before_failure: num(row.calls_before_failure),
    reply_chars: len(row.reply),
    completion: row.completion != null,
    tools: Array.isArray(row.tools) ? row.tools.map(projectTool) : [],
    sizes: row.sizes && typeof row.sizes === 'object'
      ? { history: num(row.sizes.history), lyric: num(row.sizes.lyric) }
      : null,
  };
}

function projectCheckpoint(cp) {
  if (!cp || typeof cp !== 'object') return null;
  const s = cp.state && typeof cp.state === 'object' ? cp.state : {};
  const cycle = s.cycle && typeof s.cycle === 'object' ? s.cycle : {};
  return {
    song: num(cp.song),
    next_turn: num(cp.next_turn),
    terminal: bool(cp.terminal),
    transcript_bytes: num(cp.transcript_bytes),
    turns: num(s.turns),
    retries: num(s.retries),
    parked: num(s.parked),
    park_streak: num(s.parkStreak),
    last_open: num(s.lastOpen),
    user_reasks: num(s.userReasks),
    truncated: num(s.truncated),
    hit_turn_cap: bool(s.hitTurnCap),
    hit_upstream_final: bool(s.hitUpstreamFinal),
    rate_limited: bool(s.rateLimited),
    partials: num(s.partials),
    last_status: num(s.lastStatus),
    last_error_chars: len(s.lastError),
    completion: s.completion != null,
    plan_observed: bool(s.planObserved),
    cycle: {
      accepted: num(cycle.accepted),
      rejected: num(cycle.rejected),
      unknown: num(cycle.unknown),
      first_turn: num(cycle.firstTurn),
      reasons: Array.isArray(cycle.reasons)
        ? cycle.reasons.map(([k, v]) => [ident(k), num(v)])
        : [],
    },
    cycles: Array.isArray(s.cycles) ? s.cycles.length : null,
    loop_ladder: Array.isArray(s.loopLadder)
      ? s.loopLadder.map((l) => ({
          turn: num(l.turn),
          stop: ident(l.stop),
          rounds: num(l.rounds),
          unresolved: num(l.unresolved),
          answers: num(l.answers),
        }))
      : [],
    flags: Array.isArray(s.flags)
      ? s.flags.map((f) => ({ turn: num(f.turn), flag: ident(f.flag) }))
      : [],
  };
}

const manifest = readJSONSafe(join(ROOT, 'run.json'));
const out = {
  mode: ident(manifest?.mode),
  started: typeof manifest?.started === 'string' ? manifest.started : null,
  summary: safeSummary(readJSONSafe(join(ROOT, 'summary.json'))),
  songs: [],
};
const files = existsSync(ROOT) ? readdirSync(ROOT) : [];
for (const f of files.filter((n) => /^song\d+\.checkpoint\.json$/.test(n)).sort()) {
  const n = /^song(\d+)/.exec(f)[1];
  const transcript = join(ROOT, `song${n}.jsonl`);
  const rows = existsSync(transcript)
    ? readFileSync(transcript, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((r) => r && typeof r === 'object' && Number.isFinite(r.turn))
    : [];
  out.songs.push({
    checkpoint: projectCheckpoint(readJSONSafe(join(ROOT, f))),
    turns: rows.map(projectRow),
  });
}
// The driver's own allowlisted rows (M-220): one notice per turn and the
// verdict, already written to carry no text of the model's or a person's.
const log = join(ROOT, 'driver.log');
out.driver_rows = existsSync(log)
  ? readFileSync(log, 'utf8')
      .split('\n')
      .filter((l) => /^::(notice|warning|error) title=battery (song \d+ turn \d+|verdict|partial turn)::/.test(l))
      .map((l) => l.slice(0, 600))
  : [];
console.log(JSON.stringify(out, null, 2));

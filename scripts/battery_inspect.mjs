// battery_inspect.mjs — an allowlisted projection of a battery's local record.
//
// The record under --source is private (bearer capabilities, the model's
// text, the lyric). The job log is public. This prints ONLY counts, enums,
// timings and identifier-shaped names: which turn ran how long, what each
// tool call returned, why each turn stopped, what the loop ladder reached.
// Nothing the model wrote and nothing a person wrote leaves the record.
//
// `battery_archive.mjs summary` attaches this projection as `inspection`;
// standalone: node scripts/battery_inspect.mjs --source=battery-out
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const TRANSCRIPT_LIMIT_BYTES = 32 * 1024 * 1024;

const IDENT = /^[A-Za-z0-9_.:/-]{1,64}$/;
const ident = (v) => (typeof v === 'string' && IDENT.test(v) ? v : v == null ? null : 'other');
const num = (v) => (Number.isFinite(v) ? v : null);
const secs = (ms) => (Number.isFinite(ms) ? Math.round(ms / 100) / 10 : null);
const bool = (v) => (typeof v === 'boolean' ? v : null);
const len = (v) => (v == null ? 0 : typeof v === 'string' ? v.length : JSON.stringify(v).length);
const choice = (v, values) => (v == null ? null : values.includes(v) ? v : 'other');

function readJSONSafe(file) {
  try {
    if (existsSync(file) && statSync(file).size > TRANSCRIPT_LIMIT_BYTES)
      return { unreadable: true };
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  } catch {
    return { unreadable: true };
  }
}

// Read the recorded headline, never publish it: refusals can quote private
// titles, lyrics and capabilities. Unknown headlines get a local equality
// group, not an inferred cause. The vocabulary is deliberately closed.
function refusalOf(c, groups) {
  const source =
    typeof c.refusal === 'string' && c.refusal.trim()
      ? 'harness'
      : typeof c.error === 'string' && c.error.trim()
        ? c.refused_by_connector === true
          ? 'connector'
          : 'tool_error'
        : null;
  if (!source) return null;
  const text = source === 'harness' ? c.refusal : c.error;
  const key = JSON.stringify([c.name, source, text]);
  if (!groups.has(key)) groups.set(key, groups.size + 1);
  const headline = text.replace(/^(?:Error: )?(?:REFUSED — )?/, '').trim();
  const count =
    /^the plan declares (\d+) line\(s\) and the draft carries (\d+) — they must be the same song\.$/.exec(
      headline
    );
  const code =
    /^(CREATION_ORDER|CREATION_PLAN|CREATION_DRAFT|RESOURCE_LIMIT|PROPOSER_CONFIG|PROVIDER_TRUNCATED|DECLARATION_CAPACITY|PROVIDER_REFUSAL):/.exec(
      headline
    )?.[1];
  return {
    source,
    group: groups.get(key),
    category: count ? 'PLAN_DRAFT_LINE_COUNT' : code || 'unclassified',
    ...(count ? { expected_lines: Number(count[1]), actual_lines: Number(count[2]) } : {}),
  };
}

function projectRecovery(record) {
  if (record == null) return null;
  if (record.unreadable) return { unreadable: true };
  const p = record.progress && typeof record.progress === 'object' ? record.progress : {};
  const u =
    record.proposer_usage && typeof record.proposer_usage === 'object' ? record.proposer_usage : {};
  return {
    state: choice(record.state, ['pending', 'completed', 'interrupted', 'retired']),
    uncertain_proposal: bool(record.uncertain_proposal),
    persistence_error_present: record.persistence_error != null,
    progress_present: record.progress != null,
    phase: choice(p.status, [
      'started',
      'grading',
      'proposing',
      'proposal_completed',
      'accepted',
      'finished',
    ]),
    round: num(p.round),
    completed_proposals: Array.isArray(p.proposals) ? p.proposals.length : null,
    accepted_lines: Array.isArray(p.accepted_lines) ? p.accepted_lines.length : null,
    provider_in_flight: bool(u.in_flight),
    provider_usage_unknown: bool(u.usage_unknown),
    provider_unknown_attempts: num(u.unknown_attempts),
  };
}

function projectTool(c, groups) {
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
    refusal: refusalOf(c, groups),
    status: choice(c.status, [
      'refused',
      'interrupted',
      'uncertain_proposal',
      'suspended',
      'finished_clean',
      'uncertified',
      'journal_capacity',
    ]),
    writer: choice(c.writer, ['kitchen', 'interview']),
    plan_lines: num(c.plan_lines),
    memo_hit: num(c.memo_hit),
    memo_asked: num(c.memo_asked),
    proposer_calls: num(c.proposer_calls),
    proposer_seconds: secs(c.proposer_ms),
    proposer_max_seconds: secs(c.proposer_ms_max),
    proposer_retries: num(c.proposer_retries),
    proposer_wait_seconds: num(c.proposer_wait_s),
    proposer_empty: num(c.proposer_empty),
    proposer_cost_usd: num(c.proposer_cost_usd),
  };
}

function projectRow(row, groups) {
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
    tools: Array.isArray(row.tools) ? row.tools.map((c) => projectTool(c, groups)) : [],
    sizes:
      row.sizes && typeof row.sizes === 'object'
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

export function projectRecord(source) {
  const ROOT = resolve(source);
  const manifest = readJSONSafe(join(ROOT, 'run.json'));
  const out = {
    version: 2,
    mode: ident(manifest?.mode),
    started: typeof manifest?.started === 'string' ? manifest.started : null,
    songs: [],
  };
  const files = existsSync(ROOT) ? readdirSync(ROOT) : [];
  for (const f of files.filter((n) => /^song\d+\.checkpoint\.json$/.test(n)).sort()) {
    const n = /^song(\d+)/.exec(f)[1];
    const transcript = join(ROOT, `song${n}.jsonl`);
    const tooLarge = existsSync(transcript) && statSync(transcript).size > TRANSCRIPT_LIMIT_BYTES;
    const rows =
      existsSync(transcript) && !tooLarge
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
        : [];
    const validRows = rows.filter((r) => r && typeof r === 'object' && Number.isFinite(r.turn));
    const groups = new Map();
    out.songs.push({
      checkpoint: projectCheckpoint(readJSONSafe(join(ROOT, f))),
      transcript_too_large: tooLarge,
      transcript_present: existsSync(transcript),
      unreadable_rows: rows.length - validRows.length,
      recovery: projectRecovery(readJSONSafe(join(ROOT, `song${n}.recovery.json`))),
      turns: validRows.map((row) => projectRow(row, groups)),
    });
  }
  // The driver's own allowlisted rows (M-220): one notice per turn and the
  // verdict, already written to carry no text of the model's or a person's.
  const log = join(ROOT, 'driver.log');
  out.driver_rows =
    existsSync(log) && statSync(log).size <= TRANSCRIPT_LIMIT_BYTES
      ? readFileSync(log, 'utf8')
          .split('\n')
          .filter((l) =>
            /^::(notice|warning|error) title=battery (song \d+ turn \d+|verdict)::/.test(l)
          )
          .map((l) => l.replace(/ — last error: .*$/, '').slice(0, 600))
      : [];
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = process.argv
    .slice(2)
    .find((a) => a.startsWith('--source='))
    ?.slice(9);
  if (!source) throw new Error('--source=DIR is required');
  console.log(JSON.stringify(projectRecord(source), null, 2));
}

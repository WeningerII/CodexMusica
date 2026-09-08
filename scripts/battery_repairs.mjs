// The repair numerator comes from verifier/application records, never from
// stored proposals, changed lyrics, call counts or the model's description.
import { createHash } from 'node:crypto';

const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const members = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((n) => Number.isSafeInteger(n) && n > 0) &&
  new Set(value).size === value.length;

export function repairEvents(call) {
  if (call?.name !== 'lyric_revise' || call.not_run || call.error || call.isError) return [];
  if (call.writer === 'kitchen') {
    if (call.verified_outcomes_error)
      throw new Error(`Verified repair evidence is unavailable: ${call.verified_outcomes_error}`);
    if (
      !Array.isArray(call.verified_outcomes) ||
      typeof call.journal_id !== 'string' ||
      !/^[a-f0-9]{32}$/.test(call.journal_id) ||
      !Array.isArray(call.final_draft) ||
      !call.final_draft.length ||
      !call.final_draft.every((line) => typeof line === 'string') ||
      !hash(call.verified_outcomes_draft_sha256) ||
      call.verified_outcomes_draft_sha256 !== sha(call.final_draft)
    )
      throw new Error('Kitchen repair evidence is unavailable or detached from its exact draft.');
    return call.verified_outcomes.map((record) => {
      if (
        !record ||
        !hash(record.outcome_id) ||
        !['propose', 'propose_group'].includes(record.kind) ||
        !integer(record.proposal_index) ||
        !hash(record.question_sha256) ||
        !(record.round === null || integer(record.round)) ||
        !(record.attempt === null || integer(record.attempt)) ||
        !members(record.members) ||
        record.members.some((n) => n > call.final_draft.length) ||
        typeof record.accepted !== 'boolean' ||
        typeof record.applied !== 'boolean' ||
        !hash(record.before_draft_sha256) ||
        !hash(record.after_draft_sha256) ||
        (record.applied &&
          (!record.accepted ||
            record.applied_draft_sha256 !== record.after_draft_sha256 ||
            record.before_draft_sha256 === record.after_draft_sha256))
      )
        throw new Error('Malformed verified kitchen repair record.');
      return {
        id: `kitchen:${record.outcome_id}`,
        // accepted-but-unapplied is deliberately not an accepted repair.
        verdict: record.accepted ? (record.applied ? 'accepted' : 'unapplied') : 'rejected',
        signature: sha({
          journal_id: call.journal_id,
          outcome_id: record.outcome_id,
          kind: record.kind,
          proposal_index: record.proposal_index,
          question_sha256: record.question_sha256,
          round: record.round,
          attempt: record.attempt,
          members: record.members,
          accepted: record.accepted,
          before: record.before_draft_sha256,
          after: record.after_draft_sha256,
        }),
        reasons: [],
      };
    });
  }
  if (call.writer !== 'interview') return [];
  const folded = Array.isArray(call.folded) ? call.folded : call.folded ? [call.folded] : [];
  return folded.map((record) => {
    const verified =
      record?.source === 'outcome' && ['accepted', 'rejected'].includes(record.verdict);
    if (
      verified &&
      (typeof call.run_id !== 'string' ||
        !call.run_id ||
        !['propose', 'propose_group'].includes(record.kind) ||
        !(record.round === null || integer(record.round)) ||
        (record.kind === 'propose'
          ? !Number.isSafeInteger(record.line) || record.line < 1 || !integer(record.attempt)
          : !members(record.members)))
    )
      throw new Error('Interview repair evidence has no stable run/question identity.');
    const identity = {
      run: call.run_id,
      kind: record?.kind,
      line: record?.line,
      members: record?.members,
      round: record?.round,
      attempt: record?.attempt,
      answer: record?.answer,
    };
    return {
      id: `interview:${sha(identity)}`,
      verdict: verified ? record.verdict : 'unknown',
      signature: sha({ ...identity, verdict: verified ? record.verdict : 'unknown' }),
      reasons: Array.isArray(record?.reasons) ? record.reasons : [],
    };
  });
}

// One ledger per song, persisted with its atomic driver checkpoint. An applied
// outcome can be re-emitted on every resume and still contributes only once.
export function recordRepairs(ledger, call) {
  const additions = [];
  for (const event of repairEvents(call)) {
    if (event.verdict === 'unknown') {
      additions.push(event);
      continue;
    }
    const prior = ledger.get(event.id);
    if (
      prior &&
      (prior.signature !== event.signature ||
        (prior.verdict !== event.verdict &&
          !['accepted', 'unapplied'].every((v) => [prior.verdict, event.verdict].includes(v))))
    )
      throw new Error('Conflicting verified repair identity across continuation records.');
    if (prior && (prior.verdict === event.verdict || event.verdict === 'unapplied')) continue;
    ledger.set(event.id, event);
    additions.push(event);
  }
  return additions;
}

export function acceptedRepairs(calls) {
  const ledger = new Map();
  for (const call of calls) recordRepairs(ledger, call);
  return [...ledger.values()].filter((event) => event.verdict === 'accepted').length;
}

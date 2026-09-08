// Completion is bound to the current server artifact, never an earlier exit 0.
import { createHash } from 'node:crypto';
import { recoverState } from '../mcp/state_codec.js';
import { completionTaskIdentity } from '../mcp/task_contract.js';

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

export function signedErrorEnvelope(payload) {
  // Actual /chat errors carry the signed fields at top level. Retain support
  // for archived nested envelopes, but never sign/replay error or tool fields.
  for (const value of [payload?.envelope, payload]) {
    if (Array.isArray(value?.history) && typeof value?.sig === 'string' && value.sig) {
      return {
        history: value.history,
        workspace: value.workspace ?? null,
        ...(value.lyric != null ? { lyric: value.lyric } : {}),
        ...(value.task != null ? { task: value.task } : {}),
        sig: value.sig,
      };
    }
  }
  return null;
}

export function completedArtifact(payload, status = 200) {
  if (status !== 200 || payload?.error || payload?.stopped) return null;
  const proof = payload?.completion;
  const artifact = payload?.artifact;
  const latest = Array.isArray(payload?.tools)
    ? payload.tools.filter((tool) => tool.name === 'lyric_revise').at(-1)
    : null;
  if (
    proof?.certified !== true ||
    artifact?.certified !== true ||
    payload.task?.domain !== 'lyrics' ||
    proof.task_sha256 !== sha256(JSON.stringify(completionTaskIdentity(payload.task))) ||
    typeof payload.reply !== 'string' ||
    !payload.reply.trim() ||
    artifact.text !== payload.reply ||
    proof.draft_fp !== artifact.draft_fp ||
    typeof proof.draft_fp !== 'string' ||
    !proof.draft_fp ||
    !Array.isArray(artifact.final_draft) ||
    !artifact.final_draft.length ||
    proof.final_draft_sha256 !== sha256(JSON.stringify(artifact.final_draft)) ||
    artifact.final_draft_sha256 !== proof.final_draft_sha256 ||
    proof.delivery_sha256 !== sha256(payload.reply) ||
    !latest ||
    latest.certified !== true ||
    latest.exit_code !== 0 ||
    latest.draft_fp !== proof.draft_fp ||
    latest.final_draft_sha256 !== proof.final_draft_sha256
  )
    return null;
  return { ...proof };
}

const HASH = /^[0-9a-f]{64}$/;
const JOURNAL_ID = /^[0-9a-f]{32}$/;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const natural = (value) => Number.isSafeInteger(value) && value >= 0;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const draft = (value) =>
  Array.isArray(value) && value.length > 0 && value.every((line) => typeof line === 'string');
const buildFields = [
  'commit',
  'release_id',
  'source_sha256',
  'config_sha256',
  'assets_sha256',
  'asset_manifest_sha256',
];
const validBuild = (build) =>
  /^[0-9a-f]{40}$/.test(build?.commit || '') &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(build?.release_id || '') &&
  buildFields.slice(2).every((key) => HASH.test(build?.[key] || ''));
const taskIdentity = (task) =>
  task?.domain === 'lyrics' &&
  typeof task.brief === 'string' &&
  task.brief.trim() &&
  object(task.plan?.args) &&
  object(task.plan.result) &&
  same(task.plan.args, task.plan.result.request) &&
  task.plan.sha256 === sha256(JSON.stringify(task.plan.result))
    ? completionTaskIdentity(task)
    : null;

// Decode the real bounded, checksummed journal without demanding that an offline
// consumer's local assets match the measured server. The native resume receipt
// proves execution admitted these same bytes; health receipts bind the build.
function wallJournal(payload, build) {
  if (
    !validBuild(build) ||
    payload?.stopped !== 'MAX_TURN_MS' ||
    payload.error ||
    !taskIdentity(payload.task) ||
    !Array.isArray(payload.history) ||
    !payload.history.length ||
    typeof payload.sig !== 'string' ||
    !payload.sig ||
    payload.lyric?.resumable !== true ||
    payload.lyric.uncertain_proposal ||
    !object(payload.lyric.decl) ||
    typeof payload.lyric.checkpoint !== 'string'
  )
    return null;
  try {
    const recovered = recoverState(payload.lyric.checkpoint, { part: 'journal' });
    const journal = recovered.journal;
    if (
      recovered.checksum_verified !== true ||
      recovered.source_format !== 'gzip+base64' ||
      !HASH.test(recovered.source_semantic_identity || '') ||
      journal?.version !== 1 ||
      journal.connector_semantic_identity !== recovered.source_semantic_identity ||
      !JOURNAL_ID.test(journal.journal_id || '') ||
      !draft(journal.input_draft) ||
      !draft(journal.accepted_lines) ||
      journal.input_draft.length !== journal.accepted_lines.length ||
      !same(payload.lyric.replay_draft, journal.input_draft) ||
      !same(payload.lyric.final_draft, journal.accepted_lines) ||
      !['started', 'grading', 'proposal_completed', 'accepted'].includes(journal.status) ||
      journal.uncertain_proposal ||
      journal.new_run_required ||
      typeof journal.config_key !== 'string' ||
      !journal.config_key ||
      typeof journal.proposer !== 'string' ||
      !journal.proposer ||
      !object(journal.connector_declarations) ||
      journal.connector_declarations.writer !== 'kitchen' ||
      !Object.entries(payload.lyric.decl).every(([key, value]) =>
        same(value, journal.connector_declarations[key])
      ) ||
      !Array.isArray(journal.proposals) ||
      !journal.proposals.length ||
      !journal.proposals.every(
        (entry) =>
          object(entry) &&
          ['propose', 'propose_group'].includes(entry.kind) &&
          HASH.test(entry.question_sha256 || '') &&
          Object.hasOwn(entry, 'answer') &&
          (entry.answer === null ||
            (entry.kind === 'propose'
              ? typeof entry.answer === 'string'
              : Array.isArray(entry.answer) &&
                entry.answer.every((line) => typeof line === 'string')))
      ) ||
      !Array.isArray(journal.verified_outcomes)
    )
      return null;
    return journal;
  } catch {
    return null;
  }
}

export function wallCheckpoint(payload, build) {
  return wallJournal(payload, build) !== null;
}

export function wallContinued(
  checkpoint,
  payload,
  status,
  { checkpointBuild, continuationBuild } = {}
) {
  const journal = wallJournal(checkpoint, checkpointBuild);
  if (
    !journal ||
    !validBuild(continuationBuild) ||
    !buildFields.every((key) => checkpointBuild[key] === continuationBuild[key]) ||
    status !== 200 ||
    payload?.error ||
    (payload?.stopped && !['LYRICS_UNFINISHED', 'MAX_STEPS'].includes(payload.stopped)) ||
    !same(taskIdentity(checkpoint.task), taskIdentity(payload?.task)) ||
    !Array.isArray(payload.history) ||
    !payload.history.length ||
    typeof payload.sig !== 'string' ||
    !payload.sig ||
    !Array.isArray(payload.tools)
  )
    return false;
  const oldApplied = journal.verified_outcomes
    .filter((entry) => entry?.accepted === true && entry.applied === true)
    .map((entry) => entry.outcome_id);
  if (
    oldApplied.some((id) => !HASH.test(id || '')) ||
    new Set(oldApplied).size !== oldApplied.length
  )
    return false;
  const startHash = sha256(JSON.stringify(journal.accepted_lines));
  const tool = payload.tools.filter((entry) => entry?.name === 'lyric_revise').at(-1);
  return (() => {
    if (
      tool?.name !== 'lyric_revise' ||
      tool.writer !== 'kitchen' ||
      tool.not_run ||
      tool.isError ||
      tool.error ||
      tool.refusal ||
      tool.resume_proof_error ||
      tool.verified_outcomes_error ||
      tool.journal_id !== journal.journal_id ||
      !(
        (tool.exit_code === 0 && tool.status === 'finished_clean') ||
        (tool.exit_code === 3 &&
          ['stopped_with_open_lines', 'stopped_with_whole_draft_flags'].includes(tool.status))
      )
    )
      return false;
    if (tool.exit_code === 0) {
      if (payload.lyric != null || !completedArtifact(payload, status)) return false;
    } else if (
      payload.lyric?.parked !== true ||
      payload.lyric.exit_code !== 3 ||
      !same(payload.lyric.draft, tool.final_draft) ||
      !same(payload.lyric.final_draft, tool.final_draft) ||
      !object(payload.lyric.decl) ||
      Object.keys(payload.lyric.decl).length !== Object.keys(checkpoint.lyric.decl).length ||
      !Object.entries(checkpoint.lyric.decl).every(([key, value]) =>
        same(value, payload.lyric.decl[key])
      )
    ) {
      return false;
    }
    const proof = tool.resume_proof;
    if (
      proof?.version !== 1 ||
      proof.checkpoint_loaded !== true ||
      proof.journal_id !== journal.journal_id ||
      !HASH.test(proof.input_checkpoint_sha256 || '') ||
      proof.wire_checkpoint_sha256 !== sha256(checkpoint.lyric.checkpoint) ||
      proof.input_draft_sha256 !== sha256(JSON.stringify(journal.input_draft)) ||
      proof.accepted_draft_sha256_at_start !== startHash ||
      !Array.isArray(proof.applied_outcome_ids_at_start) ||
      !same(proof.applied_outcome_ids_at_start, [...oldApplied].sort()) ||
      proof.completed_proposals_at_start !== journal.proposals.length ||
      proof.completed_proposals_replayed !== journal.proposals.length ||
      proof.completed_proposal_redispatches !== 0 ||
      proof.replay_prefix_consumed !== true ||
      !natural(proof.new_proposer_dispatches) ||
      !draft(tool.final_draft) ||
      tool.final_draft.length !== journal.input_draft.length ||
      tool.final_draft_sha256 !== sha256(JSON.stringify(tool.final_draft)) ||
      tool.verified_outcomes_draft_sha256 !== tool.final_draft_sha256 ||
      !Array.isArray(tool.verified_outcomes)
    )
      return false;
    const seen = new Set();
    // A replay interrupted halfway can retain the furthest accepted draft but
    // only the reverified prefix of its old receipts. Reconstruct the FULL
    // applied chain, then measure advancement after the accepted-draft frontier.
    let current = proof.input_draft_sha256,
      advanced = false,
      reached = current === startHash,
      lastIndex = -1;
    const appliedIds = new Set();
    let frontierIds = new Set();
    for (const outcome of tool.verified_outcomes) {
      if (!HASH.test(outcome?.outcome_id || '') || seen.has(outcome.outcome_id)) return false;
      seen.add(outcome.outcome_id);
      if (outcome.accepted !== true || outcome.applied !== true) continue;
      if (
        !natural(outcome.proposal_index) ||
        outcome.proposal_index <= lastIndex ||
        outcome.proposal_index >= journal.proposals.length + proof.new_proposer_dispatches ||
        !['propose', 'propose_group'].includes(outcome.kind) ||
        !HASH.test(outcome.question_sha256 || '') ||
        (outcome.proposal_index < journal.proposals.length &&
          (outcome.question_sha256 !== journal.proposals[outcome.proposal_index].question_sha256 ||
            outcome.kind !== journal.proposals[outcome.proposal_index].kind ||
            journal.proposals[outcome.proposal_index].answer === null)) ||
        !Array.isArray(outcome.members) ||
        !outcome.members.length ||
        new Set(outcome.members).size !== outcome.members.length ||
        !outcome.members.every(
          (n) => Number.isSafeInteger(n) && n >= 1 && n <= tool.final_draft.length
        ) ||
        outcome.before_draft_sha256 !== current ||
        !HASH.test(outcome.after_draft_sha256 || '') ||
        outcome.applied_draft_sha256 !== outcome.after_draft_sha256
      )
        return false;
      advanced ||=
        reached &&
        !oldApplied.includes(outcome.outcome_id) &&
        outcome.after_draft_sha256 !== current;
      current = outcome.after_draft_sha256;
      lastIndex = outcome.proposal_index;
      appliedIds.add(outcome.outcome_id);
      if (current === startHash) {
        reached = true;
        advanced = false;
        frontierIds = new Set(appliedIds);
      }
    }
    return (
      reached &&
      advanced &&
      current !== startHash &&
      current === tool.final_draft_sha256 &&
      oldApplied.every((id) => frontierIds.has(id))
    );
  })();
}

export function allSongsExpected(summary, count, expect) {
  return (
    Number.isSafeInteger(count) &&
    count > 0 &&
    Array.isArray(summary?.songs) &&
    summary.songs.length === count &&
    Array.from({ length: count }, (_, i) => summary.songs[i]).every(
      (song, i) =>
        song?.song === i &&
        (expect === 'survey' ||
          (expect === 'finished'
            ? song.exit_reason === 'finished' && song.completion?.certified === true
            : song.exit_reason === 'turn_wall_continued' &&
              song.wall_continuation?.verified === true))
    )
  );
}

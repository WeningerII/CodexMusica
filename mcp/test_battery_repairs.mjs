import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptedRepairs, recordRepairs } from '../scripts/battery_repairs.mjs';
import { sha256 } from '../scripts/battery_verdict.mjs';

const digest = (draft) => sha256(JSON.stringify(draft));
function kitchen(patch = {}, callPatch = {}) {
  const final = ['A verified new line'];
  return {
    name: 'lyric_revise',
    writer: 'kitchen',
    journal_id: '1'.repeat(32),
    final_draft: final,
    verified_outcomes_draft_sha256: digest(final),
    verified_outcomes: [
      {
        outcome_id: 'a'.repeat(64),
        kind: 'propose',
        proposal_index: 0,
        question_sha256: 'b'.repeat(64),
        round: 1,
        attempt: 0,
        members: [1],
        accepted: true,
        applied: true,
        before_draft_sha256: digest(['Original line']),
        after_draft_sha256: digest(final),
        applied_draft_sha256: digest(final),
        ...patch,
      },
    ],
    ...callPatch,
  };
}

test('actual application identities count once across repeated calls and durable ledger restore', () => {
  const call = kitchen();
  assert.equal(acceptedRepairs([call, structuredClone(call), call]), 1);
  const ledger = new Map();
  assert.equal(recordRepairs(ledger, call).filter((r) => r.verdict === 'accepted').length, 1);
  const restored = new Map(JSON.parse(JSON.stringify([...ledger])));
  assert.equal(recordRepairs(restored, call).length, 0);
  assert.equal(
    acceptedRepairs([
      call,
      kitchen({ outcome_id: 'c'.repeat(64) }, { journal_id: '2'.repeat(32) }),
    ]),
    2
  );
});

test('verified but unapplied, rejected, and unchanged proposals do not prove an applied repair', () => {
  const pending = kitchen({ applied: false, applied_draft_sha256: undefined });
  assert.equal(acceptedRepairs([pending]), 0);
  assert.equal(acceptedRepairs([pending, kitchen(), pending, kitchen()]), 1);
  const rejected = kitchen({ accepted: false, applied: false, applied_draft_sha256: undefined });
  assert.equal(acceptedRepairs([rejected]), 0);
  const noop = kitchen({
    accepted: false,
    applied: false,
    applied_draft_sha256: undefined,
    before_draft_sha256: digest(['A verified new line']),
  });
  assert.equal(acceptedRepairs([noop]), 0);
  assert.equal(acceptedRepairs([kitchen({}, { verified_outcomes: [] })]), 0);
});

test('missing or malformed kitchen evidence refuses instead of being reported as zero', () => {
  for (const call of [
    kitchen({}, { verified_outcomes: undefined }),
    kitchen({}, { verified_outcomes: null, verified_outcomes_error: 'malformed native receipt' }),
    kitchen({}, { journal_id: null }),
    kitchen({}, { journal_id: 'malformed-journal' }),
    kitchen({}, { final_draft: ['altered after verification'] }),
    kitchen({ accepted: 'true' }),
    kitchen({ applied: true, accepted: false }),
    kitchen({ applied_draft_sha256: 'e'.repeat(64) }),
    kitchen({ members: [2] }),
    kitchen({ before_draft_sha256: digest(['A verified new line']) }),
  ])
    assert.throws(() => acceptedRepairs([call]), /evidence|record/i);
});

test('conflicting reused outcome IDs cannot inflate or overwrite accepted evidence', () => {
  for (const changed of [
    kitchen({ question_sha256: 'd'.repeat(64) }),
    kitchen({}, { journal_id: '3'.repeat(32) }),
    kitchen({ accepted: false, applied: false, applied_draft_sha256: undefined }),
  ])
    assert.throws(() => acceptedRepairs([kitchen(), changed]), /Conflicting/);
});

test('interview outcomes remain separate; unvisited, inferred and unexecuted answers are not accepted', () => {
  const call = {
    name: 'lyric_revise',
    writer: 'interview',
    run_id: 'interview-one',
    folded: {
      kind: 'propose',
      line: 1,
      attempt: 0,
      round: 1,
      answer: 'Actual answer',
      verdict: 'accepted',
      source: 'outcome',
      reasons: ['fixed a measured finding'],
    },
  };
  assert.equal(acceptedRepairs([call, structuredClone(call)]), 1);
  assert.equal(acceptedRepairs([{ ...call, writer: undefined }]), 0);
  assert.equal(acceptedRepairs([{ ...call, writer: 'unrecognized' }]), 0);
  assert.equal(
    acceptedRepairs([
      {
        ...call,
        verified_outcomes: null,
        verified_outcomes_error: 'No authenticated kitchen inventory',
      },
    ]),
    1
  );
  assert.equal(acceptedRepairs([{ ...call, folded: { ...call.folded, source: 'unverified' } }]), 0);
  assert.equal(acceptedRepairs([{ ...call, folded: { ...call.folded, source: 'derived' } }]), 0);
  assert.equal(
    acceptedRepairs([
      { ...call, not_run: true },
      { ...call, error: 'refused' },
    ]),
    0
  );
  assert.throws(() => acceptedRepairs([{ ...call, run_id: undefined }]), /identity/);
  assert.throws(() => acceptedRepairs([{ ...call, writer: 'kitchen' }]), /unavailable/);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const api = { lySha256: sha };
vm.createContext(api);
vm.runInContext(fs.readFileSync('src/pages/lyrics-evidence.js', 'utf8'), api);
const generated = JSON.parse(
  execFileSync(
    'python3',
    [
      '-c',
      `
import json
from quality.test_schema_instance_evidence import EvidenceTests
x=EvidenceTests();x.setUp()
r=x.report();r['identity']['provenance']['voices']=True
print(json.dumps(r))
`,
    ],
    { env: { ...process.env, PYTHONPATH: 'lyric-harness' }, encoding: 'utf8' }
  )
);
function fixture() {
  const evidence = structuredClone(generated);
  const source = evidence.source_text;
  const text = '[VERSE]\n' + source;
  const context = {
    requestId: 'request-fixture',
    document: { semanticId: 'semantic-fixture', text, readerScheme: 'v2', voices: true },
    binding: {
      identityHash: evidence.identity.hash,
      requestId: 'request-fixture',
      sourceText: source,
      semanticId: 'semantic-fixture',
      text,
      readerScheme: 'v2',
      voices: true,
      sourceMap: [{ sourceStart: 0, sourceEnd: source.length, start: 8, end: text.length }],
    },
  };
  return { evidence, context, view: () => api.lyRelationEvidenceView(evidence, context) };
}

test('actual serialized instances bind by exact source map, including repeated words', () => {
  const f = fixture(),
    view = f.view();
  assert.equal(view.freshness, 'current');
  assert.equal(view.pairs.length, f.evidence.records.length);
  assert(view.pairs.some((p) => p.canGo));
  const starts = Object.values(view.occurrences).flatMap((o) =>
    o.parts.filter((p) => p.text === 'cat').map((p) => p.start)
  );
  assert(starts.includes(8));
  assert(starts.includes(16));
  assert.equal(view.document.exactTextHash, sha(f.context.document.text));
});

test('missing, mismatched request and stale declaration identities disable paint and Go', () => {
  for (const mutate of [
    (f) => {
      delete f.context.binding;
    },
    (f) => {
      f.context.requestId = 'other-request';
    },
    (f) => {
      f.evidence.identity.source_sha256 = 'bad';
    },
    (f) => {
      f.context.document.semanticId = 'changed';
    },
    (f) => {
      f.context.document.readerScheme = 'v1';
    },
    (f) => {
      f.context.document.voices = false;
    },
    (f) => {
      f.context.document.text += '!';
    },
  ]) {
    const f = fixture();
    mutate(f);
    const view = f.view();
    assert.notEqual(view.freshness, 'current');
    assert(view.pairs.every((p) => !p.canPaint && !p.canGo));
    assert(Object.values(view.occurrences).every((o) => !o.canGo));
  }
  assert.equal(api.lyRelationEvidenceView(null).coverage.status, 'unavailable');
});

test('row precision, missing source maps, invalid UTF-16 boundaries and bad records fail closed', () => {
  const f = fixture();
  f.context.binding.sourceMap = [];
  assert(f.view().pairs.every((p) => !p.canGo));
  const g = fixture();
  g.evidence.records[0].a.source_ranges[0].precision = 'row';
  assert.equal(
    g.view().occurrences[g.view().pairs.find((p) => p.id === g.evidence.records[0].id).a].canGo,
    false
  );
  const h = fixture();
  h.evidence.records[0].a.source_ranges[0].utf16_range = [0, 900000];
  assert.equal(
    h.view().occurrences[h.view().pairs.find((p) => p.id === h.evidence.records[0].id).a].canGo,
    false
  );
  const j = fixture();
  j.evidence.records.push(j.evidence.records[0]);
  assert.equal(j.view().coverage.complete, false);
  assert.equal(j.view().coverage.reason, 'invalid_or_missing_records');
});

test('discontinuous parts require explicit part Go; Close/reopen and multi-jump retain origin', () => {
  const f = fixture();
  const record = f.evidence.records[0];
  record.a.source_ranges = [
    { precision: 'exact', utf16_range: [0, 3] },
    { precision: 'exact', utf16_range: [8, 11] },
  ];
  const view = f.view();
  const origin = {
    text: f.context.document.text,
    start: 4,
    end: 7,
    direction: 'backward',
    scrollTop: 123,
  };
  let session = api.lyRelationSessionOpen(view, origin, { tab: 'history', scrollTop: 55 });
  session = api.lyRelationSessionSelect(session, view, record.id, 'a');
  assert.equal(session.selected, null);
  assert.match(session.reason, /explicit/);
  session = api.lyRelationSessionSelect(session, view, record.id, 'a', 1);
  const jumps = [];
  const hooks = {
    go: (payload, index) => {
      jumps.push({ payload, index });
      return { ok: true };
    },
  };
  session = api.lyRelationSessionGo(session, view, hooks);
  session = api.lyRelationSessionClose(session);
  assert.equal(session.armed, true);
  assert.equal(session.listOpen, false);
  session = api.lyRelationSessionReopen(session);
  session = api.lyRelationSessionSelect(session, view, record.id, 'a', 0);
  session = api.lyRelationSessionGo(session, view, hooks);
  assert.equal(jumps[0].index, 1);
  assert.equal(jumps[1].index, 0);
  assert.equal(jumps[0].payload.parts.length, 2);
  assert.equal(jumps[0].payload.text, f.context.document.text);
  assert.equal(session.origin, origin);
  const rendered = api.lyRelationInspectorMarkup(view, session);
  assert.match(rendered, /Go to A part 1/);
  assert.match(rendered, /Go to A part 2/);
});

test('stale Go never calls editor; failed Return offers Stay without mutation; Back uses actual prior panel', () => {
  const f = fixture(),
    view = f.view(),
    pair = view.pairs.find((p) => p.canGo);
  const origin = { text: f.context.document.text, start: 0, end: 0 };
  let session = api.lyRelationSessionOpen(view, origin);
  session = api.lyRelationSessionSelect(session, view, pair.id, 'a', 0);
  f.context.document.semanticId = 'edited';
  session = api.lyRelationSessionGo(session, f.view(), {
    go: () => {
      throw Error('must not navigate');
    },
  });
  assert.match(session.reason, /no longer current/);
  session = api.lyRelationSessionReturn(session, {
    restore: () => ({ ok: false, reason: 'Origin text changed.' }),
  });
  assert.equal(session.armed, true);
  assert.equal(session.origin, origin);
  session = api.lyRelationSessionBack(session, {
    back: () => {
      throw Error('no previous panel');
    },
  });
  assert.match(session.reason, /no previous panel/);
  session = api.lyRelationSessionStay(session);
  assert.equal(session.armed, false);
  assert.equal(session.origin, null);
  const previous = { tab: 'history', focus: 'item', scrollTop: 99 };
  session = api.lyRelationSessionOpen(view, origin, previous);
  session = api.lyRelationSessionBack(session, {
    back: (p) => {
      assert.equal(p, previous);
      return true;
    },
  });
  assert.equal(session.listOpen, false);
  assert.equal(session.armed, false);
  session = api.lyRelationSessionOpen(view, origin, previous);
  session = api.lyRelationSessionReturn(session, {
    restore: (o) => {
      assert.equal(o, origin);
      return true;
    },
  });
  assert.equal(session.armed, false);
});

test('candidate options and declarations do not manufacture measured pairs; partial coverage stays partial', () => {
  const f = fixture();
  f.context.candidateOptions = [{ a: 'cat', b: 'hat' }];
  f.context.declarations = [{ members: [1, 2] }];
  f.evidence.records = [];
  f.evidence.coverage = {
    complete: false,
    status: 'partial',
    loaded_records: 0,
    total_records: null,
  };
  const view = f.view();
  assert.equal(view.pairs.length, 0);
  assert.equal(view.candidateOptions.length, 1);
  assert.equal(view.declarations.length, 1);
  assert.match(api.lyRelationInspectorMarkup(view, null), /not a complete census/);
});

test('writing hook shape isolates a selected pair and clears same-text stale marks', () => {
  const f = fixture(),
    view = f.view();
  const pair = view.pairs.find((p) => p.canPaint);
  let session = api.lyRelationSessionOpen(view, { text: view.document.text });
  assert.equal(api.lyRelationWritingMarks(view, session), null);
  session = api.lyRelationSessionSelect(session, view, pair.id, 'a', 0);
  const marks = api.lyRelationWritingMarks(view, session);
  assert.equal(marks.text, view.document.text);
  assert(Array.isArray(marks.occurrences));
  assert(marks.occurrences.length <= 2);
  assert(
    marks.occurrences.every((o) => o.canPaint && o.parts.every((p) => typeof p.text === 'string'))
  );
  const choices = api.lyRelationOccurrenceChoices(view, { start: 8, end: 19 });
  assert(choices.length > 1, 'ambiguous selected occurrences must be offered explicitly');
  assert.equal(new Set(choices.map((o) => o.id)).size, choices.length);
  f.context.document.semanticId = 'declaration-only-change';
  assert.equal(api.lyRelationWritingMarks(f.view(), session), null);
});

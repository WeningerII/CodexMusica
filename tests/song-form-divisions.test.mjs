import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describeForm, realizeForm } from '../src/song-forms.mjs';
import { projectSongFormCreation } from '../src/song-form-creation.mjs';
import { gradeObservations } from '../src/song-form-grade.mjs';

const catalog = JSON.parse(readFileSync(new URL('../data/song-forms.json', import.meta.url)));
function project(id, variant = 0) {
  const choice = describeForm(catalog, id).variants[variant];
  const counts = Object.fromEntries(choice.counts.map(({ path, min, max }) => [path, Math.min(min + 1, max ?? Infinity)]));
  const plan = realizeForm(catalog, id, { variant, counts });
  return projectSongFormCreation(plan, counts);
}
const patterns = [
  ['extempo', 0], ['call-and-response', 0], ['stamp-and-go-shanty', 0],
  ['pumping-shanty', 0], ['field-holler', 1], ['military-cadence', 1],
  ['singing-game', 0], ['eclogue', 0], ['eclogue', 1], ['tenson', 0], ['flyting', 0],
  ['epic', 0], ['epic', 1], ['verse-novel', 0], ['verse-drama', 0],
];

test('real plans, submitted native blueprints and independent score path measurements', () => {
  const contracts = patterns.map(([id, v]) => {
    const p = project(id, v);
    assert.equal(p.status, 'ready', id);
    assert.equal(p.nestedDivisions, true, id);
    return p.contract;
  });
  const program = `
import json, sys
from quality import plan
from quality.catalog_grading import _sections
out = []
for c in json.load(sys.stdin):
    total = sum(s["lines"] or 2 for s in c["sections"])
    for seed in (11, 12, 1, 2):
        try:
            planned = plan.make_plan(seed, lines=total, song_form=c)
            break
        except plan.SeedRefused:
            continue
    else:
        raise ValueError((c["id"],"no tested seed was accepted"))
    draft = ["one"] * total
    b = plan.fill_plan(planned, draft)
    for spec, section in zip(c["sections"], b["sections"]):
        assert spec["divisionPath"] == section["divisionPath"]
        assert all(mark.get("role", mark["unit"]) in planned["writer_brief"] for mark in section["divisionPath"])
    out.append({"sections":_sections(b, [{} for _ in draft]),"count":total,"seed":seed})
print(json.dumps(out))`;
  const run = spawnSync('python3', ['-B', '-c',program], {cwd:fileURLToPath(new URL('../lyric-harness',import.meta.url)),input:JSON.stringify(contracts),encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const records = JSON.parse(run.stdout);
  for (const [i,c] of contracts.entries()) {
    const {sections,count}=records[i];
    const grade = ss => gradeObservations(catalog,c.id,{variant:c.variant,counts:c.counts,lines:Array(count).fill('one'),sections:ss});
    assert.equal(grade(sections).verdict,'pass',c.id);
    const omitted = structuredClone(sections);
    delete omitted[0].divisionPath;
    assert.equal(grade(omitted).verdict,'unknown',c.id);
    const changed = structuredClone(sections);
    changed[0].divisionPath.at(-1).address = '9[9]';
    assert.equal(grade(changed).verdict,'fail',c.id);
    const shifted = structuredClone(sections);
    shifted[0].lineSpan[0] = 1;
    assert.equal(grade(shifted).verdict,'fail',c.id);
    if(c.id==='extempo') {
      const switched = structuredClone(sections);
      const speaker=switched[0].divisionPath.at(-1);
      assert.equal(speaker.role,'first-singer');
      delete speaker.role;
      assert.equal(grade(switched).verdict,'unknown');
      speaker.role='second-singer';
      assert.equal(grade(switched).verdict,'fail');
    }
  }
});

test('linear layout cannot certify simultaneity, contingent speech, or unmeasured lexical roles', () => {
  for (const id of ['round','catch','canon','quodlibet','short-drag-shanty','battle-rap','alliterative-verse']) {
    assert.equal(project(id).status,'unsupported',id);
  }
  const selected = project('skeltonic-verse');
  assert.equal(selected.status,'ready');
  assert.deepEqual(selected.contract.rhymeGroups, [[1,2,3]]);
  const args = {variant:0, counts:selected.contract.counts,sections:[{role:'verse',lineSpan:[0,3]}]};
  const grade = keys => gradeObservations(catalog,'skeltonic-verse',{
    ...args, lines:keys.map((rhyme,i)=>({rhyme,text:String(i)})),
  });
  assert.equal(grade(['r','r','r']).verdict,'pass');
  assert.equal(grade(['r','s','r']).verdict,'fail');
});

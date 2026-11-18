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
  ['roundelay',0], ['roundelay',1],
  ['hammer-song-chain-gang-song', 0], ['ring-shout', 0],
  ['duet-dialogue-song', 0], ['halyard-shanty', 0], ['capstan-shanty', 0], ['versicles-and-responses', 0],
];

test('real plans, submitted native blueprints and independent score path measurements', () => {
  const contracts = patterns.map(([id, v]) => {
    const p = project(id, v);
    assert.equal(p.status, 'ready', id);
    assert.equal(p.nestedDivisions, true, id);
    return p.contract;
  });
  const program = `
import copy, json, sys
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
    if c["returnGroups"]:
        measured_groups = plan.SC._normalise_returns([g.split(",") for g in planned["returns"].split(";")], total, plan.SC.ReturnRule())
        assert [list(g.lines) for g in measured_groups] == c["returnGroups"]
    draft = ["one"] * total
    b = plan.fill_plan(planned, draft)
    for spec, section in zip(c["sections"], b["sections"]):
        assert spec["divisionPath"] == section["divisionPath"]
        assert all(mark.get("role", mark["unit"]) in planned["writer_brief"] for mark in section["divisionPath"])
    measured = [{"text":line} for line in draft]
    sections = _sections(b, measured)
    measured = copy.deepcopy(measured)
    expected_turns = [path[-1]["role"] for part in c["sections"] for path in part.get("linePaths", [])]
    assert [line["divisionPath"][-1]["role"] for line in measured if "divisionPath" in line] == expected_turns
    if expected_turns:
        first=next(i for i,r in enumerate(b["lines"]) if "divisionPath" in r)
        original = planned["line_slots"][first]["divisionPath"][-1]["role"]
        b["lines"][first]["divisionPath"][-1]["role"] = "different"
        assert planned["line_slots"][first]["divisionPath"][-1]["role"] == original
        assert original in planned["writer_brief"]
    out.append({"sections":sections,"lines":measured,"count":total,"seed":seed})
print(json.dumps(out))`;
  const run = spawnSync('python3', ['-B', '-c',program], {cwd:fileURLToPath(new URL('../lyric-harness',import.meta.url)),input:JSON.stringify(contracts),encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const records = JSON.parse(run.stdout);
  for (const [i,c] of contracts.entries()) {
    const {sections,lines}=records[i];
    const grade = (ss, observation = lines) => gradeObservations(catalog,c.id,{variant:c.variant,counts:c.counts,lines:observation,sections:ss});
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
    const firstTurn=lines.findIndex(line => line.divisionPath);
    if(firstTurn>=0) {
      const sung = structuredClone(lines);
      delete sung[firstTurn].divisionPath;
      assert.equal(grade(sections,sung).verdict,'unknown',c.id);
      const reassigned = structuredClone(lines);
      reassigned[firstTurn].divisionPath.at(-1).role='different';
      const result = grade(sections,reassigned);
      assert.equal(result.verdict,'fail',c.id);
      assert.deepEqual(result.checks.filter(x=>x.outcome==='fail').map(x=>[x.kind,x.lines]),
        [['line-turn',[firstTurn+1]]]);
    }
    if(c.id==='roundelay') {
      const groups=c.returnGroups;
      assert.deepEqual(groups,c.variant===0 ? [[3,6,9]] : [[3,7,11],[4,8,12]]);
      assert.deepEqual(c.sections.map(x=>x.role),['verse','refrain','verse','refrain','verse','refrain']);
      const revised=structuredClone(lines);
      revised[0].text='independent stanza';
      assert.equal(grade(sections,revised).verdict,'pass');
      revised[groups[0].at(-1)-1].text='changed refrain';
      const result=grade(sections,revised);
      const failures = result.checks.filter(x=>x.outcome==='fail');
      assert.deepEqual(failures.map(x=>x.kind).sort(), ['returns', 'verbatim-refrain']);
      assert.deepEqual(failures.find(x=>x.kind==='returns').lines, groups[0]);
      delete revised[groups[0].at(-1)-1].text;
      assert.equal(grade(sections,revised).verdict,'unknown');
    } else if(c.returnGroups.length) {
      const [responseLines]=c.returnGroups;
      assert.deepEqual(responseLines, [2,4,6]);
      const calls = structuredClone(lines);
      for (let n=0; n<calls.length; n+=2) calls[n].text = 'independent ' + n;
      assert.equal(grade(sections,calls).verdict,'pass',c.id);
      const last=calls.at(-1);
      last.text='changed response';
      const drift=grade(sections,calls);
      assert.equal(drift.verdict,'fail',c.id);
      assert.deepEqual(drift.checks.filter(x=>x.outcome==='fail').map(x=>[x.kind,x.lines]),[['returns',responseLines]]);
      delete last.text;
      last.returns='claimed identical';
      assert.equal(grade(sections,calls).verdict,'unknown',c.id);
    }
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
  for (const id of ['round','catch','canon','quodlibet','short-drag-shanty','echo-song','military-cadence','lined-out-hymn','battle-rap','alliterative-verse']) {
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

test('ending word classes require a text line and its observed sung tokens', () => {
  const form = project('tritina');
  assert.equal(form.status, 'ready');
  const { sections: parts, endingWords } = form.contract;
  let cursor = 0;
  const sections = parts.map(({role, divisionPath, lines}) => ({
    role, divisionPath, lineSpan: [cursor, cursor += lines],
  }));
  const lines = Array(cursor);
  const words = ['one', 'two', 'three'];
  for (const [i, group] of endingWords.groups.entries()) {
    for (const n of group) lines[n - 1] = { text: words[i], sungWords: [words[i]] };
  }
  lines[cursor - 1] = { text: words.join(' '), sungWords: words };
  const grade = rows => gradeObservations(catalog, 'tritina', { variant: 0, lines: rows, sections });
  assert.equal(grade(lines).verdict, 'pass');
  for (const unmeasured of [{ endWord: 'E' }, { sungWords: ['one'] }, { text: 'one' },
    { text: 'one', sungWords: null }]) {
    assert.equal(grade([unmeasured, ...lines.slice(1)]).verdict, 'unknown');
  }
  const aside = [...lines];
  aside[cursor - 1] = { text: 'one two (three)', sungWords: ['one', 'two'] };
  assert.equal(grade(aside).checks.find(c => c.kind === 'gathered-end-words').outcome, 'fail');
});

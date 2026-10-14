"""Real deferred journal, fixture prompts/outcomes; no native-grader claim."""
import sys, pathlib, tempfile, json, contextlib, io, time
from unittest.mock import patch
root=pathlib.Path('/workspace/acceptance-68e');sys.path.insert(0,str(root/'lyric-harness'))
import lyric_harness as LH
from quality.revise import Brief
out=pathlib.Path('/workspace/acceptance-tail')
initial=['original one','original two','original three','original four']
briefs=[Brief(n,s) for n,s in enumerate(initial,1)]
for b in briefs:b.round_no=1
prompts={b.line_no:f'COMPLETE L{b.line_no}\n'+'\U0001f4a7'*100000 for b in briefs}
evidence=dict(head='68e213d0aadf589319bce345b8eebc4b0d0a60f1',host_continuation_limit=4,continuations=0,working_cap=LH.JOURNAL_WORK_BYTES,initial=initial,steps=[],scope='real journal admission/replay; fixture-rendered prompts and fixture verification outcomes')
def resume(path):
 evidence['continuations']+=1
 assert evidence['continuations']<=evidence['host_continuation_limit']
 return LH._defer_proposer(str(path),initial)
def step(label,state):
 evidence['steps'].append(dict(label=label,pending_lines=[r['line'] for r in state['pending']['record']['records']] if state.get('pending') and state['pending']['kind']=='propose_batch' else None,accepted_lines=list(state['accepted_lines']),answered=json.loads(json.dumps(state['answered'])),outcomes=json.loads(json.dumps(state['outcomes'])),journal_bytes=LH._journal_bytes(state)))
start=time.time()
with tempfile.TemporaryDirectory() as tmp, patch('quality.propose.render_line',side_effect=lambda b,*a,**k:prompts[b.line_no]),patch('quality.propose.render_batch',side_effect=lambda bs,*a,**k:'\n'.join(prompts[b.line_no] for b in bs)):
 path=pathlib.Path(tmp)/'state'
 one,_,d=LH._defer_proposer(str(path),initial)
 try:one.prefetch(briefs[0],briefs[1:],initial)
 except LH._NeedProposal as e:first=e
 else:raise AssertionError('must suspend')
 subset=[x['line'] for x in first.record['records']];tail=[n for n in range(1,5) if n not in subset]
 assert subset==[1,2] and tail==[3,4] and len(tail)>0
 assert LH._journal_bytes(d.state)<LH.JOURNAL_WORK_BYTES
 evidence.update(first_subset=subset,omitted_tail=tail);step('first capacity-split question',d.state)
 path.write_text(json.dumps(d.state))
 # Host drops all live objects; unresolved prompt must replay byte-for-byte.
 with contextlib.redirect_stdout(io.StringIO()) as captured:
  try:resume(path)
  except SystemExit as e:assert e.code==4
  else:raise AssertionError('unanswered question must repeat')
 assert captured.getvalue().endswith(first.prompt+'\n')
 saved=json.loads(path.read_text());saved['pending']['answer']='L1: accepted one\nL2: rejected two';path.write_text(json.dumps(saved))
 one,_,d=resume(path)
 assert one(briefs[0],initial,0)=='accepted one';assert one(briefs[1],initial,0)=='rejected two'
 one.record(1,0,1,'accepted one',True,[]);one.record(2,0,1,'rejected two',False,['fixture rejection'])
 d.state['accepted_lines'][0]='accepted one';accepted=list(d.state['accepted_lines'])
 try:one.prefetch(briefs[2],briefs[3:],accepted)
 except LH._NeedProposal as e:later=e
 else:raise AssertionError('nonempty tail must be asked')
 assert [x['line'] for x in later.record['records']]==tail
 assert [x['line'] for x in d.state['answered']['propose']]==subset
 step('tail asked, first accepted edit retained',d.state);path.write_text(json.dumps(d.state))
 # Second interruption occurs before any tail answer; exact question and prefix survive.
 with contextlib.redirect_stdout(io.StringIO()) as captured:
  try:resume(path)
  except SystemExit as e:assert e.code==4
  else:raise AssertionError('unanswered tail must repeat')
 assert captured.getvalue().endswith(later.prompt+'\n')
 saved=json.loads(path.read_text());assert saved['accepted_lines']==accepted
 saved['pending']['answer']='L3: accepted three\nL4: accepted four';path.write_text(json.dumps(saved))
 one,_,d=resume(path)
 assert [one(b,accepted,0) for b in briefs]==['accepted one','rejected two','accepted three','accepted four']
 assert [x['line'] for x in d.state['answered']['propose']]==[1,2,3,4]
 assert d.state['accepted_lines']==accepted
 assert [x['accepted'] for x in d.state['outcomes']]==[True,False]
 step('tail answers folded but not falsely accepted',d.state)
 one.record(3,0,1,'accepted three',True,[]);one.record(4,0,1,'accepted four',True,[])
 d.state['accepted_lines'][2:] = ['accepted three','accepted four']
 assert d.state['accepted_lines']==['accepted one','original two','accepted three','accepted four']
 step('fixture verification accepted tail edits',d.state)
 evidence.update(pass_result=True,duration_seconds=time.time()-start,actual_retained_edits=[dict(line=1,before='original one',after='accepted one'),dict(line=3,before='original three',after='accepted three'),dict(line=4,before='original four',after='accepted four')])
(out/'batch_tail.json').write_text(json.dumps(evidence,indent=2)+'\n')
print('PASS nonempty capacity tail [3,4]; first [1,2]; four bounded host continuations; retained L1, rejected L2, tail answers pending until fixture verification; final edits L1,L3,L4.')

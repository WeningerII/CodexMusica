from pathlib import Path
import sys,os,json,contextlib,io,tempfile,hashlib
from unittest.mock import patch
sys.path.insert(0,'/workspace/scratch/b0544e4bbdd6/production-fixes/lyric-harness')
import lyric_harness as LH
from quality.revise import Reviser,ReviseDeclaration
from quality.schemes import mandate
from quality.loop import _try_tier1
r=Reviser(rdecl=ReviseDeclaration(attempts_per_line=1,max_rounds=2))
m=mandate([[1,2]],n_lines=4,default_relation='class:ASSONANCE')
before=['The elephant elephant elephant elephant elephant elephant '+w for w in ['stove','coat','rain','stone']]
answers=['My kettle whistles by the stove','Your fingers brush my heavy coat','The window shakes beneath the heavy rain','His folded paper rests upon the stone']
calls=[]
def writer(b,*args,**kwargs):calls.append(b.line_no);return answers[b.line_no-1]
def step(one,current,n):
 b=next(b for b in r.brief(current,m,include_offers=False) if b.line_no==n);b.round_no=1
 attempt,after=_try_tier1(r,b,list(current),m,r.rdecl,None,None,None,None,one)
 if not attempt.accepted:raise AssertionError((n,attempt.reason))
 one.checkpoint(after,1,'accepted')
 return after
out={}
with tempfile.TemporaryDirectory() as tmp,patch.dict(os.environ,{'LYRIC_CHECKPOINT_PATH':str(Path(tmp)/'cp')}),contextlib.redirect_stdout(io.StringIO()):
 cp=Path(tmp)/'cp';one,_=LH._checkpoint_proposer(writer,None,before,'nested-cfg','fake')
 current=list(before)
 for n in [1,2,3]:current=step(one,current,n)
 out['original']=json.loads(cp.read_text());out['calls_after_original']=list(calls)
 resumed,_=LH._checkpoint_proposer(writer,None,before,'nested-cfg','fake')
 partial=step(resumed,list(before),1)
 out['partial']=json.loads(cp.read_text());out['calls_after_partial']=list(calls)
 twice,_=LH._checkpoint_proposer(writer,None,before,'nested-cfg','fake')
 current=list(before)
 for n in [1,2,3,4]:current=step(twice,current,n)
 out['final']=json.loads(cp.read_text());out['calls_after_final']=list(calls)
 out['final_record']=twice.verification_record()
 out['final_lines']=current
out['scope']='Actual Reviser.verify through _try_tier1, persisted native checkpoints, two finite resumes, no model or scoring mocks.'
Path('/workspace/scratch/b0544e4bbdd6/production-fix-results/int35-nested-replay-probe.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'original_outcomes':len(out['original']['verified_outcomes']),'partial_outcomes':len(out['partial']['verified_outcomes']),'partial_kept_furthest':out['partial']['accepted_lines']==out['original']['accepted_lines'],'final_outcomes':len(out['final']['verified_outcomes']),'calls':calls,'resume_proof':out['final_record']['resume_proof']},indent=2))

import os,sys,time,json
sys.path.insert(0,os.getcwd())
import lyric_harness as H
from quality import revise as R, loop as L
class ProbeComplete(Exception):pass
start=time.monotonic();calls=0;original_grade=R.Reviser.grade;original_offer=R.Reviser.declared_offer
active=False

def offer(self,candidates,*a,**kw):
 global active
 active=True
 print('POOL',json.dumps({'count':len(candidates) if hasattr(candidates,'__len__') else None,'first_words':candidates[:8] if isinstance(candidates,list) else None,'requested':sorted(kw.get('requested_obligations') or [])}),flush=True)
 return original_offer(self,candidates,*a,**kw)
def grade(self,lines,mandate=None,*a,**kw):
 global calls
 if active and (calls>=10 or time.monotonic()-start>120):raise ProbeComplete()
 if active:
  calls+=1
  print('GRADE_START',json.dumps({'call':calls,'line1':lines[0],'groups':sorted(kw.get('_only_groups') or []),'obligations':sorted(kw.get('_only_obligations') or []),'moot':sorted(kw.get('_moot') or [])}),flush=True)
 t=time.monotonic();out=original_grade(self,lines,mandate,*a,**kw)
 if active:print('GRADE_END',json.dumps({'call':calls,'seconds':time.monotonic()-t,'pairs':out['pairs_mandated'],'bad':len(out['violations']),'unknown':len(out['refused_obligations'])}),flush=True)
 return out
R.Reviser.declared_offer=offer;R.Reviser.grade=grade
sys.argv=['lyric_harness.py','finish','/tmp/warm-diagnosis-479/draft.txt','--seed=1','--lines=24','--attempts=3','--propose=defer:/tmp/warm-diagnosis-479/trace-state.json']
os.environ['LYRIC_REQUEST_DEADLINE_MS']=str((time.time()+599)*1000)
try:H.main()
except ProbeComplete:print('PROBE_STOP',calls,round(time.monotonic()-start,3),flush=True)

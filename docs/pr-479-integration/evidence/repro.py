import os,sys,time,faulthandler
sys.path.insert(0,os.getcwd())
import lyric_harness as H
from quality import loop as L
orig=L.Deadline.step
def step(self,name,fn,*a,**kw):
 t=time.time(); print('STEP START',name,round(self.at-t,2),'longest',round(self.longest,2),flush=True)
 try:return orig(self,name,fn,*a,**kw)
 finally:print('STEP END',name,round(time.time()-t,2),'longest',round(self.longest,2),flush=True)
L.Deadline.step=step
faulthandler.dump_traceback_later(90,repeat=True)
for i in range(2):
 sys.argv=['lyric_harness.py','finish','/tmp/warm-diagnosis-479/draft.txt','--seed=1','--lines=24','--attempts=3','--propose=defer:/tmp/warm-diagnosis-479/state.json']
 os.environ['LYRIC_REQUEST_DEADLINE_MS']=str((time.time()+599)*1000)
 print('CALL',i,flush=True)
 try:H.main()
 except SystemExit as e:print('EXIT',e.code,flush=True)

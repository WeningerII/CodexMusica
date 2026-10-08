import os,sys,time
sys.path.insert(0,os.getcwd())
import lyric_harness as H
from quality import loop as L
orig_place=L._VerdictCache._place
def place(self,lines,line,position,build):
 print('PLACE ID',line,repr(position),flush=True)
 return orig_place(self,lines,line,position,build)
L._VerdictCache._place=place
orig=L.Deadline.step
def step(self,name,fn,*a,**kw):
 t=time.time(); print('STEP START',name,round(self.at-t,2),'longest',round(self.longest,2),flush=True)
 try:return orig(self,name,fn,*a,**kw)
 finally:print('STEP END',name,round(time.time()-t,2),'longest',round(self.longest,2),flush=True)
L.Deadline.step=step

for i in range(2):
 sys.argv=['lyric_harness.py','finish','/tmp/warm-diagnosis-479/draft.txt','--seed=1','--lines=24','--attempts=3','--propose=defer:/tmp/warm-diagnosis-479/state311.json']
 os.environ['LYRIC_REQUEST_DEADLINE_MS']=str((time.time()+599)*1000)
 print('CALL',i,flush=True)
 try:H.main()
 except SystemExit as e:print('EXIT',e.code,flush=True)

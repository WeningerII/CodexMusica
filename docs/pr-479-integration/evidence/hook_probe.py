import os,sys,json
sys.path.insert(0,os.getcwd())
from quality import loop as L, replay_memo as M
from quality.revise import Reviser
class R(Reviser):
 def __init__(self): self.built=[]
 def brief(self,lines,mandate=None,**kw):
  def build(p): self.built.append(p); return {'place':p,'words':['stone','rain']}
  return [self.place_hook(lines,1,p,lambda p=p:build(p)) for p in ('head','end')]
class D:
 def __init__(self,stop):self.steps=[];self.stop=stop
 def step(self,name,fn,*a,**kw):
  self.steps.append(name)
  if len(self.steps)==self.stop:raise L.SafePointStop(name)
  return fn(*a,**kw)
slot={'store':{},'tally':{'hit':0,'miss':0,'bypass':0,'overflow':0},'cap':None}
r=R(); proxy=M.MemoReviser(r,slot); lines=['same draft']
first=L._VerdictCache(proxy,{}, {},deadline=D(3))
try:first.brief(lines,None,target_lines={1});raise AssertionError('did not stop')
except L.SafePointStop:pass
assert r.place_hook is None and r.built==['head']
saved=json.loads(json.dumps(first.menus_on(lines)))
second=L._VerdictCache(proxy,{}, {},deadline=D(None));second.load_menus(saved)
out=second.brief(lines,None,target_lines={1})
assert r.built==['head','end'] and r.place_hook is None
third=L._VerdictCache(proxy,{}, {},deadline=D(None));out2=third.brief(lines,None,target_lines={1})
assert out2==out and r.built==['head','end'] and r.place_hook is None
print(json.dumps({'pass':True,'checks':6,'first_steps':first._deadline.steps,'second_steps':second._deadline.steps,'third_steps':third._deadline.steps,'builds':r.built,'memo_tally':slot['tally']}))

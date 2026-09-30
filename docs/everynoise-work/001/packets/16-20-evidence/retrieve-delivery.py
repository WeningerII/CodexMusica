import json,urllib.request,pathlib,hashlib,time
from PIL import Image
p=pathlib.Path(__file__).parent;r=json.loads((p/'retrieval.json').read_text())
for k,v in r['photos'].items():
 original=v['api']['url'].split('?')[0];prefix,filename=original.rsplit('/',1)
 for role,width in [('full',1920 if k=='polish_ambient' else 1280 if k in ['pop_ambient','warm_drone'] else 960 if k=='ritual_ambient' else 500),('thumb',330)]:
  u=prefix.replace('https://upload.wikimedia.org/wikipedia/commons/','https://thumb.wikimedia.org/wikipedia/commons/thumb/')+'/'+filename+'/'+str(width)+'px-'+filename
  try:
   with urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'CodexMusicaResearch/1.0'}),timeout=50) as h:
    b=h.read();target=p/(k+'-'+role+'-delivery.jpg');target.write_bytes(b)
    with Image.open(target) as im: dimensions=list(im.size);fmt=im.format
    v[role+'_delivery']={'requested_url':u,'status':h.status,'final_url':h.geturl(),'content_type':h.headers.get('Content-Type'),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'dimensions':dimensions,'format':fmt,'local_path':str(target.resolve())}
  except Exception as e:v[role+'_delivery']={'requested_url':u,'error':str(e)}
  print(k,role,v[role+'_delivery'],flush=True)
  (p/'retrieval.json').write_text(json.dumps(r,indent=2,ensure_ascii=False)+'\n')

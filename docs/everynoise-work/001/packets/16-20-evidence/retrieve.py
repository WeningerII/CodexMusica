import json, urllib.request, urllib.parse, pathlib, time, hashlib
from PIL import Image
OUT=pathlib.Path(__file__).parent
HEAD={'User-Agent':'CodexMusicaResearch/1.0 (public source validation)'}
def get(url):
 req=urllib.request.Request(url,headers=HEAD)
 with urllib.request.urlopen(req,timeout=60) as r:
  return r.status,r.geturl(),dict(r.headers),r.read()
receipt={'checked_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'membership':{},'photos':{}}
for label,slug in [('polish ambient','polishambient'),('pop ambient','popambient'),('ritual ambient','ritualambient'),('warm drone','warmdrone'),('world meditation','worldmeditation')]:
 record={}
 for host,prefix in [('everynoise.com',''),('furia.com','everynoise_public/')]:
  url='https://'+host+'/'+prefix+'engenremap-'+slug+'.html'
  try:
   status,final,h,b=get(url);target=OUT/(slug+'-'+host+'.html');target.write_bytes(b)
   record[url]={'status':status,'final_url':final,'bytes':len(b),'content_type':h.get('Content-Type'),'local_path':str(target.resolve())}
  except Exception as e: record[url]={'error':str(e)}
 receipt['membership'][label]=record
 print(label,record,flush=True)
files={'polish_ambient':'Michał Jacaszek.JPG','pop_ambient':'Wolfgang Voigt 2012.jpg','ritual_ambient':'Lustmord.jpg','warm_drone':'Rafael Anton Irisarri at Café Oto (11 March 2024).jpg','world_meditation':'Nawang Khechog.jpg'}
for key,title in files.items():
 params={'action':'query','prop':'imageinfo','iiprop':'url|extmetadata|size','iiurlwidth':960,'format':'json','titles':'File:'+title}
 url='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params)
 rec={'metadata_api_url':url}
 try:
  status,final,h,b=get(url);data=json.loads(b);info=next(iter(data['query']['pages'].values()))['imageinfo'][0];rec['api']=info
  (OUT/(key+'-commons.json')).write_bytes(b)
  page=info['descriptionurl']
  try:
   status,final,h,b=get(page);(OUT/(key+'-commons.html')).write_bytes(b);rec['file_page']={'status':status,'final_url':final,'bytes':len(b),'content_type':h.get('Content-Type')}
  except Exception as e: rec['file_page']={'error':str(e)}
  for role,asset in [('full',info['url']),('thumb',info.get('thumburl',info['url']))]:
   asset=asset.split('?')[0]
   try:
    status,final,h,b=get(asset);target=OUT/(key+'-'+role+'.jpg');target.write_bytes(b)
    with Image.open(target) as im: dimensions=list(im.size);fmt=im.format
    rec[role]={'requested_url':asset,'status':status,'final_url':final,'content_type':h.get('Content-Type'),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'dimensions':dimensions,'format':fmt,'local_path':str(target.resolve())}
   except Exception as e: rec[role]={'requested_url':asset,'error':str(e)}
 except Exception as e: rec['error']=str(e)
 receipt['photos'][key]=rec
 (OUT/'retrieval.json').write_text(json.dumps(receipt,indent=2,ensure_ascii=False)+'\n')
 print(key,{k:v for k,v in rec.items() if k!='api'},flush=True)
(OUT/'retrieval.json').write_text(json.dumps(receipt,indent=2,ensure_ascii=False)+'\n')

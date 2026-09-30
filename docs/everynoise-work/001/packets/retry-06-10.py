import urllib.request,json,pathlib,io
from PIL import Image
p=pathlib.Path('docs/everynoise-work/001/packets');f=p/'06-10.json';x=json.loads(f.read_text())
for e in x['entries']:
 m=e['photo']['manifest'];v=e['photo']['verification']
 if v.get('commons_api_receipt',{}).get('success'):v['rights_metadata']='Commons_API_imageinfo_extmetadata_read_with_creator_and_license'
 for which,key in [('full','image_url'),('thumbnail','thumb_url')]:
  old=v[which+'_fetch_receipt']
  if old.get('success'):continue
  url=m[key]
  if which=='thumbnail':url=url.replace('upload.wikimedia.org','thumb.wikimedia.org').replace('/800px-','/960px-')
  else:url+='?download=1'
  rec=dict(method='GET',requested_url=url,success=False)
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CodexMusicaResearch/1.0'}),timeout=40)as r:
    b=r.read();rec.update(success=True,http_status=r.status,final_url=r.geturl(),mime_type=r.headers.get('Content-Type'),bytes=len(b))
    with Image.open(io.BytesIO(b))as im:rec['decoded_dimensions']=list(im.size);rec['decoded_format']=im.format;im.verify();rec['decoded_verified']=True
    path=p/(e['id']+'-'+which+'.jpg');path.write_bytes(b);rec['local_path']=str(path.resolve())
   m[key]=url
  except Exception as er:rec.update(error=str(er),http_status=getattr(er,'code',None))
  v[which+'_prior_fetch_receipt']=old;v[which+'_fetch_receipt']=rec;v[which+'_fetch_result']='success'if rec['success']else'HTTP_or_network_failure'
 v['bytes_checked']=all(v[k+'_fetch_receipt'].get('decoded_verified',False)for k in ['full','thumbnail']);v['decoded_dimensions']=v['full_fetch_receipt'].get('decoded_dimensions');v['final_full_url']=v['full_fetch_receipt'].get('final_url');v['final_thumb_url']=v['thumbnail_fetch_receipt'].get('final_url');v['http_status']=v['full_fetch_receipt'].get('http_status')
 print(e['id'],v['bytes_checked'],v['full_fetch_receipt'].get('http_status'),v['thumbnail_fetch_receipt'].get('http_status'),flush=True)
f.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')

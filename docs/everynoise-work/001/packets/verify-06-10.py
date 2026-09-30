import urllib.request,urllib.parse,json,pathlib,concurrent.futures,io
from PIL import Image
p=pathlib.Path('docs/everynoise-work/001/packets'); f=p/'06-10.json'; packet=json.loads(f.read_text())
def fetch(u):
 req=urllib.request.Request(u,headers={'User-Agent':'CodexMusicaResearch/1.0 (license and source verification)'})
 try:
  with urllib.request.urlopen(req,timeout=45) as r:
   b=r.read();return dict(success=True,http_status=r.status,final_url=r.geturl(),mime_type=r.headers.get('Content-Type'),bytes=len(b)),b
 except Exception as err:return dict(success=False,error=str(err),http_status=getattr(err,'code',None)),None
def job(e):
 m=e['photo']['manifest'];v=e['photo']['verification']
 title=urllib.parse.unquote(m['source_page'].split('/wiki/')[1]);api='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode({'action':'query','format':'json','titles':title,'prop':'imageinfo','iiprop':'url|size|mime|extmetadata','iiurlwidth':800})
 receipt,b=fetch(api);v['commons_api_receipt']=receipt
 if b:
  (p/(e['id']+'-commons-api.json')).write_bytes(b)
  try:
   info=next(iter(json.loads(b)['query']['pages'].values()))['imageinfo'][0]
   m['image_url']=info['url'];m['thumb_url']=info.get('thumburl',info['url']);v['image_urls_provenance']='Commons_API_imageinfo';v['commons_api_metadata']=info
  except Exception as er:v['commons_api_parse_error']=str(er)
 for which,key in [('full','image_url'),('thumbnail','thumb_url')]:
  receipt,b=fetch(m[key]);v[which+'_fetch_receipt']=receipt
  if b:
   imagepath=p/(e['id']+'-'+which+'.jpg');imagepath.write_bytes(b)
   try:
    with Image.open(io.BytesIO(b))as im:receipt['decoded_dimensions']=list(im.size);receipt['decoded_format']=im.format;im.verify()
    receipt['decoded_verified']=True;receipt['local_path']=str(imagepath.resolve())
   except Exception as er:receipt['decode_error']=str(er)
  v[which+'_fetch_result']='success' if receipt['success'] else 'HTTP_or_network_failure'
 v['bytes_checked']=all(v[k+'_fetch_receipt'].get('decoded_verified',False)for k in ['full','thumbnail'])
 v['decoded_dimensions']=v['full_fetch_receipt'].get('decoded_dimensions');v['final_full_url']=v['full_fetch_receipt'].get('final_url');v['final_thumb_url']=v['thumbnail_fetch_receipt'].get('final_url');v['http_status']=v['full_fetch_receipt'].get('http_status')
 for which,url in [('original',e['source_url']),('mirror','https://furia.com/everynoise_public/engenremap-'+e['source_label'].replace(' ','')+'.html')]:
  receipt,b=fetch(url);e['membership'][which+'_fetch_receipt']=receipt
  if b:(p/(e['id']+'-everynoise-'+which+'.html')).write_bytes(b)
 print(e['id'], 'photo',v['bytes_checked'],'EN',e['membership']['original_fetch_receipt'].get('http_status'), 'mirror',e['membership']['mirror_fetch_receipt'].get('http_status'),flush=True)
 return e
with concurrent.futures.ThreadPoolExecutor(max_workers=5)as pool:packet['entries']=list(pool.map(job,packet['entries']))
f.write_text(json.dumps(packet,ensure_ascii=False,indent=2)+'\n')

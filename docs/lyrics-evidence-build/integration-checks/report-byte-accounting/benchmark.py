import json,sys,time,types,subprocess,hashlib
from pathlib import Path
root=Path('/workspace/musica-lyrics-integration')
sys.path.insert(0,str(root/'lyric-harness'))
from quality.schema_instance_evidence import from_stream
from quality.phonology.eng import English
import lyric_harness as LH
from quality import relations as R
from library.contracts import canonical_json
old=types.ModuleType('before_report')
old.__file__=str(root/'lyric-harness/quality/schema_instance_evidence.py')
source=subprocess.check_output(['git','show','31b4140452f7bfb95b39512f1e477c39382c9942:lyric-harness/quality/schema_instance_evidence.py'],cwd=root,text=True)
exec(compile(source,old.__file__,'exec'),old.__dict__)
phon=English(lexicon=LH.Lexicon())
stream=R.build_stream(['The kettle whistles by the stove']*12,phon,declaration={'language':'eng'})
outputs=[]
for label,fn in [('before',old.from_stream),('after',from_stream),('before-repeat',old.from_stream),('after-repeat',from_stream)]:
 wall=time.monotonic();cpu=time.process_time()
 result=fn(stream,phon,declarations={'voices':True},provenance={'reader_scheme':'v2','fixture':True})
 wall=time.monotonic()-wall;cpu=time.process_time()-cpu
 blob=canonical_json(result).encode('utf-8');outputs.append(blob)
 print(json.dumps({'label':label,'wall':wall,'cpu':cpu,'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'records':len(result['records'])}),flush=True)
assert all(b==outputs[0] for b in outputs)
print('Exact old/new canonical UTF-8 bytes equal for all four reports')

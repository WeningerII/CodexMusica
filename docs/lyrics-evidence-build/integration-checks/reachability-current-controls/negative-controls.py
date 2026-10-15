from pathlib import Path
import subprocess,os
out=Path('/tmp/reachability-repair')
html=(out/'codex.html').read_text()
env=dict(os.environ,NODE_PATH='/workspace/musica-repair/node_modules',PLAYWRIGHT_BROWSERS_PATH='/tmp/musica-browsers')
for action in ['ly-run-review','copy-lyrics','ly-copy-sung','ly-download','ly-export-session']:
 script='<script>new MutationObserver(()=>{document.querySelectorAll(\'[data-ui="'+action+'"]\').forEach(e=>e.remove())}).observe(document.documentElement,{childList:true,subtree:true});</script>'
 target=out/f'missing-{action}.html'
 target.write_text(html.replace('</body>',script+'</body>'))
 with (out/f'missing-{action}.txt').open('w') as log:
  result=subprocess.run(['node',str(out/'after-runner.js'),'--html='+str(target)],env=env,stdout=log,stderr=subprocess.STDOUT)
 expected='lyrics-review-draft' if action=='ly-run-review' else 'lyrics-export'
 text=(out/f'missing-{action}.txt').read_text()
 assert result.returncode==1 and expected+': selector resolved to 0 elements' in text,(action,result.returncode,text)
 print(action,'removed: gate rejected actual missing control',flush=True)
 target.unlink()

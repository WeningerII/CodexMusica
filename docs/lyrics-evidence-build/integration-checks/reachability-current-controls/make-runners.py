from pathlib import Path
import subprocess
root=Path('/workspace/musica-lyrics-integration')
out=Path('/tmp/reachability-repair')
for tag in ['before','after']:
 s=subprocess.check_output(['git','show','30e52b401380393a6671cdddf5a4794b22065731:scripts/ui_reachability_check.js'],cwd=root,text=True) if tag=='before' else (root/'scripts/ui_reachability_check.js').read_text()
 s=s.replace("require('./_inventory_parser.js')",f"require('{root}/scripts/_inventory_parser.js')").replace("require('./_paths.js')",f"require('{root}/scripts/_paths.js')")
 s=s.replace("path.join(__dirname, '..', 'assets', 'icon-192.png')",repr(str(root/'assets/icon-192.png')))
 if tag=='before':
  (out/'before-inventory.md').write_text(subprocess.check_output(['git','show','30e52b401380393a6671cdddf5a4794b22065731:tests/ui_capability_inventory.md'],cwd=root,text=True))
  s=s.replace("parseInventory('tests/ui_capability_inventory.md')",f"parseInventory('{out}/before-inventory.md')")
 s=s.replace("'file://' + testHtml", "'http://127.0.0.1:8936/' + path.basename(testHtml)")
 (out/f'{tag}-runner.js').write_text(s)

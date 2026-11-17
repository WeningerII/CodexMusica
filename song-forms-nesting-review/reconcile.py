"""Rebuild the data and the review ledgers offline. Run from this folder."""
from pathlib import Path
from collections import Counter
import csv
import hashlib
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
if Path.cwd() != ROOT:
    raise SystemExit("Run from the review folder.")
def read(path): return json.loads(Path(path).read_text())
def write_json(path, data): Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
def table(path, headings, rows):
    with Path(path).open('w', newline='') as f:
        writer = csv.writer(f, delimiter='\t')
        writer.writerow(headings); writer.writerows(rows)
def catalog(path):
    group = None
    entries = []
    for number,line in enumerate(Path(path).read_text().splitlines(), 1):
        if line.startswith('## '):
            m = re.match(r"## ([A-E])\. ", line); group = m[1] if m else None
        if group and line.startswith('| ') and not line.startswith('| Form |'):
            entries.append((group,number,[x.strip() for x in line.strip('|').split('|')]))
    return entries

src=catalog('english-forms.md')
r2=catalog('comparison/r2-post.md')
assert len(src)==len(r2)==364
r2diff=[]
fields=['title','aliases','description','length','extra sections']
for (group,line,base),(grp,nr,other) in zip(src,r2):
    assert group==grp
    assert base[0]==other[0] or (base[0],other[0])==('Cinquain (Crapsey)','Cinquain')
    diffs={f:[a,b] for f,a,b in zip(fields,base,other) if a!=b}
    r2diff.append([group,line,nr,base[0],other[0],', '.join(diffs) or 'identical',json.dumps(diffs,ensure_ascii=False)])
table('comparison/r2-row-diff.tsv',['group','source_line','comment_line','catalog_title','r2_title','changed_fields','before_after'],r2diff)
srcby={cells[0]:(g,n,cells) for g,n,cells in src}
log=[]; forms=[]; links=[]; summary=Counter(); history=Counter(); kinds=Counter(); edgeverdict=Counter(); refs=set(); cited=0
for path in sorted(Path('models').glob('*.json')):
    before=read(Path('baseline/models')/path.name); now=read(path); audit=read(Path('audit')/path.name)
    assert list(before)==list(now) and set(now)==set(audit)
    for form,model in now.items():
        g,ln,cells=srcby[form]
        orig=before[form]; rev=audit[form]
        original=set(orig.get('related',[])); revised=set(model.get('related',[]))
        verdicts={e['target'] for e in rev['edges']}
        assert original|revised <= verdicts, (form,(original|revised)-verdicts)
        supported={e['target'] for e in rev['edges'] if e['status']=='supported'}
        assert supported==revised
        for e in rev['edges']:
            assert e['kind'] in {'contains','variant','shares-feature','comparison','other'}
            result=e['status']; t=e['target']
            assert t in srcby
            change=('retained' if t in original else 'added') if t in revised else ('removed' if t in original else 'withheld')
            history[change]+=1;edgeverdict[result]+=1
            if result=='supported':kinds[e['kind']]+=1
            links.append([form,ln,t,srcby[t][1],e['kind'],result,change,e['evidence'],' '.join(rev['refs'])])
        differences={key:{'before':orig.get(key),'after':model.get(key)} for key in sorted(orig.keys()|model.keys()) if orig.get(key)!=model.get(key)}
        if differences:log.append(dict(form=form,source_line=ln,changes=differences,reason=rev['note'],edges=rev['edges'],references=rev['refs']))
        assert all(isinstance(u,str) and u.startswith(('https://','http://')) for u in rev['refs'])
        refs.update(rev['refs']);cited+=bool(rev['refs'])
        summary[rev['status']]+=1
        forms.append([g,ln,form,rev['status'],model['mode'],', '.join(sorted(differences)) or 'unchanged',len(original),len(revised),rev['note'],' '.join(rev['refs'])])
assert len(forms)==364
table('coverage.tsv',['group','catalog_line','form','review_status','diagram_mode','changed_fields','old_edges','supported_edges','entry_finding','additional_references'],forms)
table('relationships.tsv',['source','source_line','target','target_line','kind','verdict','change','evidence','source_form_references'],links)
write_json('model-changes.json',log)
metrics=dict(source_rows=len(forms),row_counts=dict(Counter(row[0] for row in forms)),status=dict(summary),changed_models=len(log),fields_changed=dict(Counter(k for item in log for k in item['changes'])),edge_verdicts=dict(edgeverdict),edge_changes=dict(history),supported_kinds=dict(kinds),forms_with_additional_reference=cited,distinct_reference_urls=len(refs),r2_identical_records=sum(row[-2]=='identical' for row in r2diff),source_sha256=hashlib.sha256(Path('english-forms.md').read_bytes()).hexdigest(),r2_comment='https://github.com/WeningerII/CodexMusica/pull/665#issuecomment-6964243074')
write_json('coverage-summary.json',metrics)
subprocess.run([sys.executable,'build.py'],check=True)
print(json.dumps(metrics,ensure_ascii=False,indent=2))

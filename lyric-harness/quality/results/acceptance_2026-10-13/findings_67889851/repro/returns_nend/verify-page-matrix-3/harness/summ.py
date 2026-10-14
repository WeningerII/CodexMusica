import json,sys
for fn in sys.argv[1:]:
    print('==',fn)
    for l in open(fn):
        if l.startswith('  DECLARED RETURNS') or l.startswith('    L') or 'REFUSED' in l or l.startswith('exit=') or 'MIXES' in l: print('  ',l.rstrip()[:300])
        if 'lyric result:' in l:
            j=json.loads(l.split('lyric result:',1)[1])
            cov=j.get('coverage') or {}
            print('   JSON status=%s certified=%s return_obl=%s refused=%s flags=%s'%(j.get('status'),cov.get('certified'),[ (o['id'],o['status']) for o in cov.get('obligations',[]) if o['layer']=='return'],cov.get('refused_obligations'),[ (f['code'],f['message'][:160]) for f in j.get('findings',[]) if f['severity']=='flag']))

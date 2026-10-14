import json,sys,glob
for f in sorted(glob.glob('mount_probe_*_*.json')):
    d=json.load(open(f))
    print('=====',f,'inject',d['inject'])
    for k,r in d['scen'].items():
        if 'threw' in r: print(' ',k,'THREW',r['threw'][:300]); continue
        rr=r.get('afterBack') or r.get('afterReload') or r.get('afterRemount') or r
        ens=[(p.get('how'),p.get('ret'),p.get('before'),p.get('after'),p.get('stack','')[:60]) for p in rr.get('probe',[]) if p['tag']=='ensure']
        mount=[(p['tag'],p.get('value'),p.get('ret')) for p in rr.get('probe',[]) if p['tag'].startswith('mount')]
        changed=[e for e in ens if e[1]]
        print(' ',k,'| end draft',rr.get('draft'),'| steps',rr.get('steps'),'| undoDisabled',rr.get('undoDisabled'),'| errors',r.get('errors'))
        print('     mount probes',mount)
        print('     ensure calls',len(ens),'changed:',[(e[0],e[2][:40],e[3][:40]) for e in changed], '| mount-stack calls:',[(e[0],e[1],e[2]) for e in ens if 'mount' in e[4]])
        if k=='deferredLibraryThenLyrics': print('     atLibrary', {x:r['atLibrary'][x] for x in ('workspaceReady','view','draft')})
        if 'typed' in r: print('     typed',r['typed'])
        if k=='syntheticRemount': print('     beforeRemount',r['beforeRemount'],'appLyrics',rr.get('appLyrics'))

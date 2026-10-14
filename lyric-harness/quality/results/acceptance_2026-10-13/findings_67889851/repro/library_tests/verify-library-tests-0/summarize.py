import json, sys, glob
for f in sorted(glob.glob('c8b_wt-*_*.json')):
    d = json.load(open(f))
    print('=====', f)
    for name, s in d['scenarios'].items():
        if 'error' in s and len(s)==1:
            print(' ', name, 'ERROR', s['error'][:300]); continue
        lb = s['library_before']
        anyhit = {k: [t for t, v in sc.items() if v] for k, sc in s['scan'].items()}
        anyhit = {k: v for k, v in anyhit.items() if v}
        print(' ', name)
        print('    library: alert=%r visible=%s sheet_toggle=%s' % ((lb['undecided_alert_text'] or '')[:110], lb['undecided_alert_visible'], s['narrow_sheet_toggle_visible']))
        print('    library toasts:', [t['text'] for t in lb['toasts']])
        print('    renumbered note: %r visible=%s' % ((lb['renumbered_text'] or '')[:100], lb['renumbered_visible']))
        print('    hash after:', s['hash_after'], '| toasts after click:', [t['text'] for t in s['toasts_after_click']])
        print('    carried pronunciations:', json.dumps(s['carried_pronunciations']))
        lo = s['lyrics']['libraryOrigin']
        print('    libraryOrigin.declarations:', json.dumps(lo.get('declarations') if isinstance(lo, dict) else lo))
        print('    downloads:', [(x['name'], len(x['text'] or '')) for x in s['downloads']], 'ly_download_clicked', s.get('ly_download_clicked'))
        print('    surface_text chars:', len(s['lyrics']['surface_text']), '| history has panel:', s['history_text'] is not None)
        print('    term hits on Lyrics side:', anyhit or 'NONE')
        print('    errors:', s['errors'][:3])

# Count stored card items whose word is a strict prefix-cut of a longer word in the imported text.
import json, re, sys
for N in (10, 50, 200, 500):
    d = json.load(open(f'v_cand_txt_stress{N}.json'))
    c = d['cases'][0]
    text = c['text']
    words = set(re.findall(r'[A-Za-z]+', text))
    items = c['after']['stored']['items']; more = c['after']['stored']['more']
    cut = [it for it in items if any(len(w) > len(it['word']) and w.startswith(it['word']) and len(it['word']) == 40 for w in words)]
    long_in_text = sorted({w for w in words if len(w) > 40})
    card = c['after']['item']['text']
    ell = '…' in card.split('Nothing else')[0].replace('…', '…') and any((it['word'] + '…') in card for it in items)
    print(N, 'items', len(items), 'more', more, 'cut40', len(cut), [ (it['kind'], it['n']) for it in cut], 'longWordsInText', [len(w) for w in long_in_text], 'ellipsisAfterCutWord', ell,
          'reloadSame', c['afterReload']['sameStored'], 'lsSame', json.dumps(c['after']['localStorage']) == json.dumps(c['after']['stored']))

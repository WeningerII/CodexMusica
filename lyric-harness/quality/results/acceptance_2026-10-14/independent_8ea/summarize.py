import json
from pathlib import Path
p=Path(__file__).parent
load=lambda f:json.loads((p/f).read_text())
a=load('a_page_8ea.json');r=a['results']
assert len(r)==54 and not a['errs'] and all(x['sent'] for x in r)
assert all(bool(x['notice'])==x['fires'] for x in r)
assert all('1.end,2.end' in str(x['wire']) for x in r)
assert all('grader decides what the place binds' in x['review_text'] for x in r if x['fires'])
s=load('selection/sel6_cand_click-kbd_MIG-NOMIG.json')
assert len(s)==16 and all(not x['errors'] for x in s)
o=load('order/orders_cand_RG2.add.review.paste.json')
assert o[0]['final']==o[1]['final'] and all(not x.get('threw') and not x['errors'] for x in o)
k=load('king_8ea.json')
assert all(x['unread'] and x['stem_high_readable'] for x in k if x['text'] in ['savour-','inden-'])
assert all(not x['unread'] and not x['split'] for x in k if x['text']=='“It’s a Boo-”')
d=load('declared_8ea.json')
assert d['none']['perfect rhyme'] and d['declared king K IH1 NG']['perfect rhyme']
assert not d['declared kin K IH1 N']['perfect rhyme'] and not d['declared kingdom K IH1 NG D AH0 M']['perfect rhyme']
print(json.dumps({'a2_browser_sends':len(r),'selection':{trig+'_'+doc:{'kept':sum(x['kept'] for x in s if x['trig']==trig and x['doc']==doc),'total':4} for trig in ['click','kbd'] for doc in ['MIG','NOMIG']},'order_final_equal':True,'g2p_unread_controls':True,'declared_reading_precedence':True},indent=2))

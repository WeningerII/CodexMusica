"""Every reading in CMUdict + supplement v2 vs Moby (converted). Read-only.
Moby flags disagreements; it does not judge."""
import sys, re, collections, difflib, json
sys.path.insert(0, '.')
from quality import moby_convert as M
mpron, out = sys.argv[1], sys.argv[2]
E = M.load(mpron)
R = collections.defaultdict(list)   # word -> [(phones, source)]
for line in open('cmudict.dict', encoding='utf-8'):
    line = line.split('#')[0].strip()
    if not line: continue
    w, *ph = line.split()
    w = re.sub(r'\(\d+\)$', '', w)
    R[w].append((tuple(ph), 'cmudict'))
for line in open('data/lexicon_supplement_v2.tsv', encoding='utf-8'):
    if line.startswith('#') or line.startswith('word\t'): continue
    w, ph, src = line.rstrip('\n').split('\t')[:3]
    R[w].append((tuple(ph.split()), 'supplement:' + src))
strip = lambda t: tuple(re.sub(r'\d', '', x) for x in t)
def red(t):
    o = []
    for i, x in enumerate(t):
        b = re.sub(r'\d', '', x)
        if x[-1:] == '0' and b in ('AH', 'IH', 'IY', 'EH', 'UW'): b = '@'
        if b in ('IY', 'IH') and i + 1 < len(t) and t[i + 1] == 'NG': b = 'I'
        o.append(b)
    return tuple(o)
def subs(a, b):
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False); r = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op != 'equal': r.append(' '.join(a[i1:i2]) + '→' + ' '.join(b[j1:j2]))
    return tuple(r)
cls = collections.Counter(); src_cls = collections.Counter(); pat = collections.Counter(); ex = collections.defaultdict(list)
stresspat = collections.Counter(); sex = collections.defaultdict(list)
for w, rs in R.items():
    if w not in E: cls['not in Moby'] += 1; continue
    ours = [r[0] for r in rs]; src = rs[0][1].split(':')[0]; m = E[w]
    if set(ours) & set(m): k = 'exact'
    elif {strip(x) for x in ours} & {strip(x) for x in m}:
        k = 'stress only'
        a = next(x for x in ours if strip(x) in {strip(y) for y in m}); b = next(y for y in m if strip(y) == strip(a))
        sp = (''.join(c[-1] for c in a if c[-1].isdigit()), ''.join(c[-1] for c in b if c[-1].isdigit()))
        stresspat[sp] += 1
        if len(sex[sp]) < 4: sex[sp].append(w)
    elif {red(x) for x in ours} & {red(x) for x in m}: k = 'reduced vowel only'
    else:
        k = 'sounds differ'
        best = min(((subs(red(a), red(b)), a, b) for a in ours for b in m), key=lambda z: len(z[0]))
        for p in best[0]:
            pat[p] += 1
            if len(ex[p]) < 5: ex[p].append(w)
    cls[k] += 1; src_cls[(src, k)] += 1
res = {"readings_words": len(R), "classes": dict(cls), "by_source": {f"{s}|{k}": n for (s, k), n in src_cls.items()},
       "stress_patterns_top": [[f"{a} vs moby {b}", n, sex[(a, b)]] for (a, b), n in stresspat.most_common(25)],
       "sound_substitutions_top": [[p, n, ex[p]] for p, n in pat.most_common(60)]}
json.dump(res, open(out, 'w'), indent=1)
print(json.dumps({k: res[k] for k in ('readings_words', 'classes', 'by_source')}, indent=1))
# Rhyme relevance: does the disagreement reach the rhyme tail (last primary vowel onward)?
def tail(t):
    idx = [i for i, x in enumerate(t) if x.endswith('1')]
    return t[idx[-1]:] if idx else t
def rtail(t):
    return tuple(re.sub(r'\d', '', x) for x in tail(t))
tail_same = 0; tail_diff = 0; tpat = collections.Counter(); tex = collections.defaultdict(list)
stress_tail_moves = 0
for w, rs in R.items():
    if w not in E: continue
    ours = [r[0] for r in rs]; m = E[w]
    if set(ours) & set(m): continue
    if {rtail(x) for x in ours} & {rtail(y) for y in m}: tail_same += 1; continue
    tail_diff += 1
    best = min(((subs(rtail(a), rtail(b)), a, b) for a in ours for b in m), key=lambda z: len(z[0]))
    key = ' | '.join(best[0]) if best[0] else '(stress moves the tail)'
    tpat[key] += 1
    if len(tex[key]) < 5: tex[key].append(w)
print('non-exact words whose rhyme tail still agrees:', tail_same, ' rhyme tail differs:', tail_diff)
for k, n in tpat.most_common(40): print(n, k, tex[k])
json.dump({"tail_same": tail_same, "tail_diff": tail_diff, "tail_patterns": [[k, n, tex[k]] for k, n in tpat.most_common(200)]}, open(out.replace('.json', '_tail.json'), 'w'), indent=1)
# Same, with reduced unstressed vowels tolerated, and known dialect/convention families tagged.
def rtail2(t): return red(tail(t))
FAM = {
 'NEAR IH~IY (M-320 licence already agrees these before R)': lambda a, b: {a, b} <= {'IH', 'IY'},
 'cot-caught AA~AO': lambda a, b: {a, b} == {'AA', 'AO'},
 'Mary-marry-merry EH~AE': lambda a, b: {a, b} == {'EH', 'AE'},
 'ER ~ schwa+R / R~ER syllabification': lambda a, b: 'ER' in (a + ' ' + b) and ('R' in (a + ' ' + b).split() or '@' in (a + b) or 'AH' in (a + b)),
 'CH ~ T SH (affricate spelling)': lambda a, b: {a, b} == {'CH', 'T SH'},
 'Z~S voicing': lambda a, b: {a, b} == {'Z', 'S'},
}
fam = collections.Counter(); other = collections.Counter(); oex = collections.defaultdict(list); fex = collections.defaultdict(list)
tot = 0
for w, rs in R.items():
    if w not in E: continue
    ours = [r[0] for r in rs]; m = E[w]
    if set(ours) & set(m): continue
    if {rtail2(x) for x in ours} & {rtail2(y) for y in m}: continue
    tot += 1
    best = min(((subs(rtail2(a), rtail2(b)), a, b) for a in ours for b in m), key=lambda z: len(z[0]))
    ss = [s.split('→') for s in best[0]]
    tags = set()
    for a, b in ss:
        t = next((n for n, f in FAM.items() if f(a.strip(), b.strip())), None)
        tags.add(t)
    if tags and None not in tags:
        k = ' + '.join(sorted(tags)); fam[k] += 1
        if len(fex[k]) < 4: fex[k].append(w)
    else:
        k = ' | '.join(s for s in best[0]) or '(stress moves the tail)'; other[k] += 1
        if len(oex[k]) < 4: oex[k].append(w)
print('\nRHYME-TAIL disagreements, reduced vowels tolerated:', tot)
print('  in known dialect/convention families:', sum(fam.values()))
for k, n in fam.most_common(): print('   ', n, k, fex[k])
print('  everything else:', sum(other.values()), 'in', len(other), 'distinct substitution patterns; top 30:')
for k, n in other.most_common(30): print('   ', n, k, oex[k])
json.dump({"tail_disagreements": tot, "families": [[k, n, fex[k]] for k, n in fam.most_common()],
           "other_total": sum(other.values()), "other_patterns": [[k, n, oex[k]] for k, n in other.most_common()]},
          open(out.replace('.json', '_tail2.json'), 'w'), indent=1)

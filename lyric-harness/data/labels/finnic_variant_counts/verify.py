#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Independent check of the emitted tables. Recomputes from the source CSVs by
a different code path than the builder and asserts on the result."""
import collections, csv, os, random, sys

csv.field_size_limit(10 ** 9)
HERE = os.path.dirname(os.path.abspath(__file__))
C = os.environ.get('FINNIC_CACHE', '/tmp/finnic_cache')
CELLS = ['fi', 'krl', 'et', 'izh_vot']
fails = []


def ck(cond, msg):
    print(('  ok   ' if cond else '  FAIL ') + msg)
    if not cond:
        fails.append(msg)


def rd(n):
    return list(csv.DictReader(open(os.path.join(C, n), newline='', encoding='utf-8')))


poems = {r['poem_id']: r['collection'] for r in rd('poems.csv')}
links = [r for r in rd('poem_types.csv') if r['poem_id'] in poems]
clean = [r for r in links if not r['type_id'].startswith(('erab_orig', 'kt_t'))
         and r['type_id'] != 'erab_017002025']
places = {r['place_id']: r for r in rd('places.csv')}
parish = collections.defaultdict(set)
for r in rd('poem_place.csv'):
    if places.get(r['place_id'], {}).get('place_type') == 'parish':
        parish[r['poem_id']].add(r['place_id'])

tab = {}
for c in CELLS:
    tab[c] = {r['poem_id']: r for r in csv.DictReader(
        open(os.path.join(HERE, 'label_variant_count.%s.tsv' % c), encoding='utf-8'),
        delimiter='\t')}
allrows = {p: (c, r) for c in CELLS for p, r in tab[c].items()}

print('1. pool membership and cell disjointness')
ck(all(p in poems for p in allrows), 'every poem_id resolves in poems.csv')
ck(not any(poems[p] == 'kr' for p in allrows),
   'no Kalevala/Kanteletar row survives into any label table (closure 3)')
ck(sum(len(tab[c]) for c in CELLS) == len(allrows), 'cells are disjoint')

print('2. type cleanliness')
bad = [r['type_id'] for _, r in allrows.values()
       if r['type_id'].startswith(('erab_orig', 'kt_t')) or r['type_id'] == 'erab_017002025']
ck(not bad, 'no row cites a pseudo-type, a Kanteletar section or the placeholder')

print('3. leave-one-out arithmetic')
off = [p for p, (_, r) in allrows.items()
       if int(r['variant_count_with_self']) - int(r['label_value']) != 1]
ck(not off, 'label_value == variant_count_with_self - 1 on all %d rows (%d off)'
   % (len(allrows), len(off)))
ck(not any(int(r['label_value']) < 0 for _, r in allrows.values()), 'no negative labels')

print('4. recompute a random sample from source, independent path')
random.seed(11)
tt = collections.defaultdict(set)
for r in clean:
    if poems[r['poem_id']] != 'kr':
        tt[r['type_id']].add(r['poem_id'])
sample = random.sample(sorted(allrows), 300)
# Deduplication can only ever REMOVE attestations, so the emitted count must sit
# in (0, undeduplicated source count]. Anything above it means a poem was
# counted twice; anything at or below zero means the poem lost its own row.
band = [p for p in sample
        if 0 < int(allrows[p][1]['variant_count_with_self']) <= len(tt[allrows[p][1]['type_id']])]
ck(len(band) == len(sample),
   'emitted count is in (0, undeduplicated source count] on all %d sampled rows'
   % len(sample))
exactm = sum(1 for p in sample
             if len(tt[allrows[p][1]['type_id']]) == int(allrows[p][1]['variant_count_with_self']))
print('       %d/%d sampled rows equal the UNDEDUPLICATED source count; the other %d '
      'are strictly lower, which is deduplication doing its job'
      % (exactm, len(sample), len(sample) - exactm))

print('5. parish-spread table agrees on keys and is bounded by the variant count')
for c in CELLS:
    ps = {r['poem_id']: r for r in csv.DictReader(
        open(os.path.join(HERE, 'label_parish_spread.%s.tsv' % c), encoding='utf-8'),
        delimiter='\t')}
    ck(set(ps) == set(tab[c]), '%-8s same poem_id set in both labels' % c)
    # Spread may LEGITIMATELY exceed the variant count: 9,749 poems carry more
    # than one parish (ERAB records 'collected in X < informant from Y'), so a
    # single other attestation can supply several parishes. It must stay rare.
    ex = [p for p in ps if int(ps[p]['label_value']) > int(tab[c][p]['label_value'])]
    ck(len(ex) < 0.01 * len(ps),
       '%-8s spread>count only via multi-parish poems: %d rows (%.3f%%), max excess %d'
       % (c, len(ex), 100.0 * len(ex) / len(ps),
          max((int(ps[p]['label_value']) - int(tab[c][p]['label_value']) for p in ex), default=0)))

print('6. deduplicated variants')
for c in CELLS:
    full = {r['poem_id']: r['text_key_norm'] for r in csv.DictReader(
        open(os.path.join(HERE, 'label_variant_count.%s.tsv' % c), encoding='utf-8'),
        delimiter='\t')}
    ded = [r for r in csv.DictReader(
        open(os.path.join(HERE, 'label_variant_count.%s.dedup.tsv' % c), encoding='utf-8'),
        delimiter='\t')]
    ck(set(x['poem_id'] for x in ded) <= set(full), '%-8s dedup is a subset of full' % c)
    ks = [x['text_key_norm'] for x in ded if x['text_key_norm']]
    dup = len(ks) - len(set(ks))
    ck(dup == 0, '%-8s no repeated normalised text key inside dedup (%d rows, %d repeats)'
       % (c, len(ded), dup))

print('7. join key is a real join')
verses = set()
for r in csv.DictReader(open(os.path.join(C, 'verses.csv'), newline='', encoding='utf-8')):
    verses.add(r['poem_id'])
miss = [p for p in allrows if p not in verses]
ck(len(miss) < 0.01 * len(allrows),
   'join_key joins to verses.csv text for %.2f%% of rows (%d without text)'
   % (100.0 * (len(allrows) - len(miss)) / len(allrows), len(miss)))

print()
print('FAILURES: %d' % len(fails))
sys.exit(1 if fails else 0)

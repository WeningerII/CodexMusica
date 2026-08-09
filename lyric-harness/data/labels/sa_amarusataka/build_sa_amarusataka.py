#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the sa survival label: editor-supplied anthology citations, Amaruśataka.

REPRODUCIBLE END-TO-END. Fetches its one source itself.

SOURCE  GRETIL 5_poetry/2_kavya/sa_amaru-amaruzataka.txt, the Kāvya-saṅgraha
  (Jīvānanda Vidyāsāgara) text collated against the Motilal 1983 Arjunavarmadeva
  commentary. Its header states: "The parentheses in between verses contain
  citations for the major anthologies. These have been taken from Sures Chandra
  Banerji's edition of Śrīdharadāsa's Sadukti-karṇāmṛta." Six sigla:
    su. = Subhāṣitaratnakoṣa      sad. = Saduktikarṇāmṛta
    subh. = Subhāṣitāvalī         sū.  = Sūktimuktāvalī
    pad. = Padyāvalī              śā.  = Śārṅgadharapaddhati

WHY THIS LABEL IS DIFFERENT FROM sa_subhasita
  Nothing is matched here. The label is a count the EDITOR supplied, so it is
  free of every orthographic problem that verbatim matching has -- and it is
  the ground truth against which sa_subhasita's verbatim recall is measured
  (see the cross-check this script prints). Its weakness is the mirror image:
  it is one 19th/20th-c. editor's apparatus, not transmission counted directly.

  Held constant across the whole pool: one poem, one author, one genre, one
  metre family, one manuscript tradition. The only thing that varies between a
  positive and a negative is whether anthologists took the verse.

POOL   the 105 numbered verses of this edition, plus 8 verses printed in the
  appendix "Verses found in Arjunavarmadeva's version not found here".

THE FILE CONTAINS THE WHOLE TEXT TWICE. The mirror emitted a second copy in
  which word-initial vowels carry a spurious macron ('ābbreviations', 'īt has
  been compared', 'āmaruśatakam'). A parser that does not notice reports 210
  verses, 84 cited, 126 uncited -- exactly double the truth, and exactly the
  figure this project had on file. The second copy is cut at its own 'Text'
  header before anything is parsed, and the deduplication step then confirms
  no duplicate body survives.

JOIN KEY: `join_key` = the GRETIL verse number within this file (poem_id is
  'amaru:<n>'). This is a within-work label, so the key is the verse id, not
  text. `join_key_text` additionally carries the normalised body key, so the
  table can be joined against sa_subhasita (which is keyed on that).

SUBSET LEAK. The positives sit inside the same 105-verse pool, and closure is
  the same operation as everywhere else: cluster by normalised body, one row
  per cluster, label = max over the cluster. Rows moved are reported below.
"""
import collections, csv, hashlib, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gretil_io as G

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = '5_poetry/2_kavya/sa_amaru-amaruzataka.txt'

SIGLA = {'su.': 'Subhasitaratnakosa', 'sad.': 'Saduktikarnamrta',
         'subh.': 'Subhasitavali', 'sū.': 'Suktimuktavali',
         'pad.': 'Padyavali', 'śā.': 'Sarngadharapaddhati'}


def main():
    raw = G.fetch(PATH)
    a = G.amaru_copy_a(raw)
    print('DUPLICATED FILE: %d chars total, copy A %d, copy B %d -- copy B dropped'
          % (len(raw), len(a), len(raw) - len(a)))
    print('  a parser that misses this reports every count DOUBLED')

    rows = [{'n': vid, 'body': body, 'sig': sig, 'kind': kind, 'motilal': mot}
            for vid, body, sig, kind, mot in G.extract_amaru(raw)]

    out = []
    for r in rows:
        kn = G.key_norm(r['body'])
        out.append({
            'poem_id': 'amaru:%s' % r['n'],
            'label_value': len(r['sig']),
            'join_key': r['n'],
            'label_binary': int(bool(r['sig'])),
            'anthologies': ','.join(SIGLA[s] for s in r['sig']) or '-',
            'sigla': ','.join(r['sig']) or '-',
            'kind': r['kind'],
            'motilal_no': r['motilal'],
            'join_key_text': kn,
            'join_key_sha1': hashlib.sha1(kn.encode()).hexdigest()[:16],
        })

    main_rows = [r for r in out if r['kind'] == 'main']
    print('\nPOOL  %d verses (%d numbered + %d appendix)'
          % (len(out), len(main_rows), len(out) - len(main_rows)))
    cited = [r for r in out if r['label_value']]
    print('CITED %d of %d  (numbered only: %d of %d)'
          % (len(cited), len(out),
             sum(1 for r in main_rows if r['label_value']), len(main_rows)))
    print('graded distribution',
          dict(sorted(collections.Counter(r['label_value'] for r in out).items())))
    per = collections.Counter(s for r in out for s in r['sigla'].split(',') if s != '-')
    print('per anthology', dict(per))

    # ------------------------------------------------------------ leak closure
    cl = collections.OrderedDict()
    for r in out:
        cl.setdefault(r['join_key_text'], []).append(r)
    ded = []
    for k, grp in cl.items():
        lab = max(g['label_value'] for g in grp)
        rep = grp[0].copy()
        rep['label_value'] = lab
        rep['label_binary'] = int(lab > 0)
        rep['n_pool_rows_collapsed'] = len(grp)
        rep['collapsed_ids'] = ';'.join(g['poem_id'] for g in grp[1:]) or '-'
        ded.append(rep)
    moved = len(out) - len(ded)
    print('\nLEAK CLOSURE  raw %d -> %d clusters, %d duplicate rows absorbed'
          % (len(out), len(ded), moved))
    print('  positives %d, negatives %d'
          % (sum(1 for d in ded if d['label_value']),
             sum(1 for d in ded if not d['label_value'])))

    # -------------------------- cross-check: verbatim recall against this truth
    try:
        sub = os.path.join(HERE, '..', 'sa_subhasita', 'label_sa_subhasita.dedup.tsv')
        vm = {}
        with open(sub, encoding='utf-8') as fh:
            for row in csv.DictReader(fh, delimiter='\t'):
                if row['work'] == 'amarusataka':
                    vm[row['join_key']] = int(row['label_value'])
        gt = [d for d in ded if any(s in ('su.', 'subh.', 'pad.')
                                    for s in d['sigla'].split(','))]
        hit = sum(1 for d in gt if vm.get(d['join_key_text'], 0) > 0)
        print('\nCROSS-CHECK vs sa_subhasita verbatim matching')
        print('  verses the EDITOR cites to an anthology GRETIL also carries')
        print('  (su./subh./pad.):            %d' % len(gt))
        print('  of those, verbatim matching recovers: %d  (recall %.0f%%)'
              % (hit, 100.0 * hit / max(1, len(gt))))
    except Exception as e:                                       # pragma: no cover
        print('cross-check skipped:', e)

    for fn, data in [('label_sa_amarusataka.tsv', out),
                     ('label_sa_amarusataka.dedup.tsv', ded)]:
        cols = ['poem_id', 'label_value', 'join_key', 'label_binary', 'anthologies',
                'sigla', 'kind', 'motilal_no', 'join_key_text', 'join_key_sha1'] + \
               (['n_pool_rows_collapsed', 'collapsed_ids'] if 'dedup' in fn else [])
        with open(os.path.join(HERE, fn), 'w', encoding='utf-8', newline='') as fh:
            w = csv.DictWriter(fh, fieldnames=cols, delimiter='\t',
                               extrasaction='ignore', lineterminator='\n')
            w.writeheader(); w.writerows(data)
        print('  wrote', fn, len(data), 'rows')


if __name__ == '__main__':
    main()

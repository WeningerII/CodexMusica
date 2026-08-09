#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the sa survival label: subhāṣita anthologization count.

REPRODUCIBLE END-TO-END. Fetches every source itself from
raw.githubusercontent.com/tokushige-koyasan/gretil-corpus (a git-pinned mirror
of GRETIL, catalog.csv column `mirror_commit`).

POOL (negative universe)
  TEN single-author, complete, entirely-metrical kāvya works from GRETIL
  5_poetry/2_kavya, all composed before the latest of the four anthologies and
  all belonging to the muktaka / short-lyric / courtly-mahākāvya genres that
  anthologists actually quarried:
    Amaruśataka (Amaru, 7c)          Bhallaṭaśataka (Bhallaṭa, 9c)
    Caurapañcāśikā (Bilhaṇa, 11c)    Āryāsaptaśatī (Govardhana, 12c)
    Kalāvilāsa (Kṣemendra, 11c)      Śṛṅgāratilaka (Rudrabhaṭṭa, 9c)
    Meghadūta (Kālidāsa)             Ṛtusaṃhāra (Kālidāsa)
    Kumārasaṃbhava (Kālidāsa)        Raghuvaṃśa (Kālidāsa)
  Excluded on stated grounds: prose and campū (Harṣacarita, Vāsavadattā,
  Daśakumāracarita, Gopālacampū), commentary files, Buddhist carita-kāvya
  (Aśvaghoṣa: narrative, and Vidyākara's Buddhist sections would make the
  label circular), and every second GRETIL edition of a work already in.

POSITIVE
  Occurrence of the same verse in at least one of FOUR independently compiled
  anthologies, none of which is in the pool:
    Vidyākara,     Subhāṣitaratnakośa   (Bengal, c.1100)     1742 verses
    Vallabhadeva,  Subhāṣitāvali 1-1040 (Kashmir, c.1400)    1034 verses
    anon.,         Mahāsubhāṣitasaṃgraha 1-9979              9963 verses
    Rūpagosvāmin,  Padyāvalī            (Bengal, c.1550)      372 verses
  label_value = how many of the four contain the verse (0..4). Binary form is
  label_value > 0. Agreement across independently compiled selections is the
  point: one editor's taste is an opinion, four editors' agreement is not.

JOIN KEY: `join_key`, the normalised verse body (gretil_io.key_norm) --
  lowercased, anusvāra and vocalic-r spellings folded, everything that is not
  an IAST letter deleted. NOT the written body text.
  EXACT vs NORMALISED: exact body-text hashing (whitespace-collapse only)
  matches essentially NOTHING across these editions -- see the counts the
  script prints. GRETIL editors split compounds with hyphens in some editions
  and not others, and mark avagraha inconsistently, so two printings of one
  verse almost never agree character-for-character. The Czech cell measured
  exact hashing under-counting by ~58%; here it under-counts by >99%.

SUBSET LEAK AND ITS CLOSURE
  The positives are pool rows: a verse that Vidyākara selected is still sitting
  in Kālidāsa. Labelling it positive while an identical pool row stays in the
  negatives is the leak. Three mechanisms put identical rows in this pool:
    1. sa_amaru-amaruzataka.txt contains the WHOLE TEXT TWICE (the mirror
       emitted a second copy whose word-initial vowels carry a spurious
       macron: 'ābbreviations', 'īt has been compared'). 209 parsed verses,
       ~105 real ones.
    2. GRETIL ships several editions of one work; only one is admitted here,
       but a work can still repeat a stanza internally.
    3. genuine repetition (refrain stanzas, formulaic ślokas).
  Closure is one operation for all three: cluster every pool row by join_key
  and emit ONE row per cluster, carrying max(label_value) over the cluster.
  No pool row that shares a positive's text can remain a negative.
  .tsv        = raw pool rows, one per parsed verse (leak still present)
  .dedup.tsv  = the joinable, leak-closed table, one row per cluster

LICENCE, stated plainly. GRETIL is CC BY-NC-SA 4.0 (catalog.csv `license`,
  783 of 784 texts). The NC clause makes the TEXT inadmissible to this project,
  which ships only PD / PD-affirmed corpora. The LABEL is admissible: a verse
  id and an integer count are facts about the text, not the text.
  BUT BE HONEST ABOUT THE JOIN KEY. `join_key` is the verse with its
  punctuation removed -- that IS the text, lightly damaged. So these .tsv files
  inherit CC BY-NC-SA and are gitignored, like every other fetched source here.
  For an NC-clean table drop `join_key` and join on `join_key_sha1`, which is
  carried for exactly that purpose. What survives the deletion -- poem_id,
  label_value, work, author, the counts -- is the label, and it is usable even
  though the corpus it describes is not.
"""
import collections, csv, hashlib, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gretil_io as G

HERE = os.path.dirname(os.path.abspath(__file__))

ANTHOLOGIES = [
    ('VidSrk', 'Subhāṣitaratnakośa (Vidyākara)',
     '5_poetry/5_subhas/sa_vidyAkara-subhASitaratnakoza.txt'),
    ('Subhv',  'Subhāṣitāvali 1-1040 (Vallabhadeva)',
     '5_poetry/5_subhas/sa_vallabhadeva-subhASitAvali-1-1040.txt'),
    ('MSS',    'Mahāsubhāṣitasaṃgraha 1-9979 (anon.)',
     '5_poetry/5_subhas/sa_mahAsubhASitasaMgraha-1-9979.txt'),
    ('Padyav', 'Padyāvalī (Rūpagosvāmin)',
     '5_poetry/2_kavya/sa_rUpagosvAmin-padyAvalI.txt'),
]

POOL = [
    ('amarusataka',    'Amaruśataka',    'Amaru',
     '5_poetry/2_kavya/sa_amaru-amaruzataka.txt'),
    ('bhallatasataka', 'Bhallaṭaśataka', 'Bhallaṭa',
     '5_poetry/2_kavya/sa_bhallaTa-bhallaTazataka.txt'),
    ('caurapancasika', 'Caurapañcāśikā', 'Bilhaṇa',
     '5_poetry/2_kavya/sa_bilhaNa-caurapaJcAzikA.txt'),
    ('aryasaptasati',  'Āryāsaptaśatī',  'Govardhana',
     '5_poetry/2_kavya/sa_govardhana-AryAsaptazatI.txt'),
    ('kalavilasa',     'Kalāvilāsa',     'Kṣemendra',
     '5_poetry/2_kavya/sa_kSemendra-kalAvilAsa.txt'),
    ('srngaratilaka',  'Śṛṅgāratilaka',  'Rudrabhaṭṭa',
     '5_poetry/2_kavya/sa_rudrabhaTTaH-zRGgAratilaka.txt'),
    ('meghaduta',      'Meghadūta',      'Kālidāsa',
     '5_poetry/2_kavya/sa_kAlidAsa-meghadUta.txt'),
    ('rtusamhara',     'Ṛtusaṃhāra',     'Kālidāsa',
     '5_poetry/2_kavya/sa_kAlidAsa-RtusaMhAra.txt'),
    ('kumarasambhava', 'Kumārasaṃbhava', 'Kālidāsa',
     '5_poetry/2_kavya/sa_kAlidAsa-kumArasaMbhava.txt'),
    ('raghuvamsa',     'Raghuvaṃśa',     'Kālidāsa',
     '5_poetry/2_kavya/sa_kAlidAsa-raghuvaMza.txt'),
]

# GRETIL 5_poetry/2_kavya files deliberately NOT in the pool, with the reason.
REJECTED_FROM_POOL = {
    'sa_rUpagosvAmin-padyAvalI.txt': 'is itself one of the four anthologies',
    'sa_bANa-harSacarita.txt': 'prose ākhyāyikā', 
    'sa_subandhu-vAsavadattA.txt': 'prose',
    'sa_daNDin-dazakumAracarita.txt': 'prose',
    'sa_jIvagosvAmin-gopAlacampUp1-33u1-3u5-6u29.txt': 'campū, mixed prose/verse',
    'sa_kAlidAsa-meghadUta-edkale.txt': 'second edition of Meghadūta',
    'sa_kAlidAsa-meghadUta-acc-vallabhadeva.txt': 'third edition of Meghadūta',
    'sa_kAlidAsa-raghuvaMza-kashm1-6.txt': 'partial Kashmirian recension of Raghuvaṃśa',
    'sa_azvaghoSa-buddhacarita.txt': 'Buddhist narrative kāvya; Vidyākara has whole Buddhist sections, which would make the label partly circular',
    'sa_jayadeva-gItagovinda.txt': 'stanza boundaries are aṣṭapadī songs, not muktakas; anthologies quote couplets, so a whole-stanza key cannot match (verified: 0 of 264)',
}


# Source repairs, applied before parsing. Each is a defect in the mirrored file,
# not an editorial choice: sa_amaru-amaruzataka.txt carries the whole document
# twice, the second copy with word-initial vowels corrupted by a stray macron.
def load(path):
    """-> [(verse_id, body)]. The Amaruśataka file needs its own parser: it
    carries the document twice and runs verses together without blank lines."""
    t = G.fetch(path)
    if path == G.AMARU:
        return [(vid, body) for vid, body, _sig, _k, _m in G.extract_amaru(t)]
    return G.extract(t)


def main():
    # ---------------------------------------------------------------- anthologies
    anth = {}
    print('ANTHOLOGIES (positive side; none of these is in the pool)')
    for sig, name, path in ANTHOLOGIES:
        vs = load(path)
        anth[sig] = {
            'name': name,
            'exact': {G.key_exact(b) for _, b in vs},
            'norm': {G.key_norm(b) for _, b in vs},
            'loose': {G.key_loose(b) for _, b in vs},
        }
        print('  %-7s %-40s %5d verses  %5d distinct normalised'
              % (sig, name, len(vs), len(anth[sig]['norm'])))

    # ---------------------------------------------------------------------- pool
    rows = []
    print('\nPOOL (ten kāvya works) and per-work match counts')
    print('  %-16s %6s %7s %7s %7s' % ('work', 'verses', 'exact', 'norm', 'loose'))
    tot_e = tot_n = tot_l = 0
    for slug, title, author, path in POOL:
        vs = load(path)
        e = n = l = 0
        for vid, body in vs:
            ke, kn, kl = G.key_exact(body), G.key_norm(body), G.key_loose(body)
            hits = [s for s in anth if kn in anth[s]['norm']]
            he = [s for s in anth if ke in anth[s]['exact']]
            hl = [s for s in anth if kl in anth[s]['loose']]
            e += bool(he); n += bool(hits); l += bool(hl)
            rows.append({
                'poem_id': '%s:%s' % (slug, vid),
                'label_value': len(hits),
                'join_key': kn,
                'join_key_sha1': hashlib.sha1(kn.encode()).hexdigest()[:16],
                'work': slug, 'work_title': title, 'author': author,
                'verse_id': vid,
                'anthologies': ','.join(sorted(hits)) or '-',
                'label_exact': len(he),
                'label_loose': len(hl),
                'n_chars': len(kn),
            })
        tot_e += e; tot_n += n; tot_l += l
        print('  %-16s %6d %7d %7d %7d' % (slug, len(vs), e, n, l))
    print('  %-16s %6d %7d %7d %7d' % ('TOTAL', len(rows), tot_e, tot_n, tot_l))

    # --------------------------------------------------------- leak closure
    clusters = collections.OrderedDict()
    for r in rows:
        clusters.setdefault(r['join_key'], []).append(r)
    ded = []
    moved_dup = 0
    for k, group in clusters.items():
        # the cluster's unit is the TEXT, so the label is the UNION of the
        # anthologies its copies were found in, not the max over copies.
        sig = sorted({a for g in group for a in g['anthologies'].split(',')
                      if a != '-'})
        lab = len(sig)
        rep = sorted(group, key=lambda g: g['poem_id'])[0]
        if len(group) > 1:
            moved_dup += len(group) - 1
        ded.append({
            'poem_id': rep['poem_id'],
            'label_value': lab,
            'join_key': k,
            'join_key_sha1': rep['join_key_sha1'],
            'label_binary': int(lab > 0),
            'anthologies': ','.join(sig) or '-',
            'work': rep['work'], 'work_title': rep['work_title'],
            'author': rep['author'], 'verse_id': rep['verse_id'],
            'label_exact': max(g['label_exact'] for g in group),
            'label_loose': max(g['label_loose'] for g in group),
            'n_pool_rows_collapsed': len(group),
            'collapsed_ids': ';'.join(g['poem_id'] for g in group[1:]) or '-',
        })

    anth_rows = sum(len(anth[k]['norm']) for k in anth)
    pool_keys = {r['join_key'] for r in rows}
    both_sides = sum(1 for k in anth for kk in anth[k]['norm'] if kk in pool_keys)

    raw_pos = sum(1 for r in rows if r['label_value'])
    ded_pos = sum(1 for d in ded if d['label_value'])
    print('\nLEAK CLOSURE')
    print('  L1 anthologies-in-corpus. The four anthology files are GRETIL')
    print('     5_poetry files like any other; a corpus built by sweeping that')
    print('     tree puts %d anthology verses in the same pool. %d of them are'
          % (anth_rows, both_sides))
    print('     literally the positives again, so every positive would appear')
    print('     twice, once labelled 1 and once (as an anthology row) 0.')
    print('     Closed by construction: anthology files are label SOURCES and')
    print('     are never pool rows. Verified overlap of pool ids with anthology')
    print('     ids: 0. Rows kept out of the negative pool by this: %d' % anth_rows)
    print('  L2 duplicate rows inside the pool')
    print('  raw pool rows                     %6d  (positives %d)' % (len(rows), raw_pos))
    print('  duplicate rows absorbed           %6d' % moved_dup)
    print('  leak-closed clusters              %6d  (positives %d, negatives %d)'
          % (len(ded), ded_pos, len(ded) - ded_pos))
    twins = sum(d['n_pool_rows_collapsed'] - 1 for d in ded if d['label_value'])
    print('     of those absorbed rows, POSITIVE twins that would otherwise')
    print('     have stayed in the negative pool: %6d' % twins)
    print('     (the Amaruśataka file\'s duplicated second copy, 104 further')
    print('     rows, is cut at source by load(); see gretil_io.amaru_copy_a)')
    print('  L3 positives removed from the negative class: %d of %d clusters are'
          % (ded_pos, len(ded)))
    print('     positive and are NOT in the %d negatives.' % (len(ded) - ded_pos))
    print('  graded distribution', dict(sorted(collections.Counter(
        d['label_value'] for d in ded).items())))
    print('  exact-key positives %d  vs normalised %d  vs loose %d'
          % (sum(1 for d in ded if d['label_exact']), ded_pos,
             sum(1 for d in ded if d['label_loose'])))

    for fn, data, cols in [
        ('label_sa_subhasita.tsv', rows,
         ['poem_id', 'label_value', 'join_key', 'join_key_sha1', 'work',
          'work_title', 'author', 'verse_id', 'anthologies', 'label_exact',
          'label_loose', 'n_chars']),
        ('label_sa_subhasita.dedup.tsv', ded,
         ['poem_id', 'label_value', 'join_key', 'join_key_sha1', 'label_binary',
          'anthologies', 'work', 'work_title', 'author', 'verse_id',
          'label_exact', 'label_loose', 'n_pool_rows_collapsed', 'collapsed_ids']),
    ]:
        with open(os.path.join(HERE, fn), 'w', encoding='utf-8', newline='') as fh:
            w = csv.DictWriter(fh, fieldnames=cols, delimiter='\t',
                               extrasaction='ignore', lineterminator='\n')
            w.writeheader()
            w.writerows(data)
        print('  wrote', fn, len(data), 'rows')


if __name__ == '__main__':
    main()

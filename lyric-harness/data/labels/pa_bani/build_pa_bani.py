#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the pa survival label: bani membership inside the shipped scripture.

REPRODUCIBLE END-TO-END. Fetches its source itself from registry.npmjs.org
(@shabados/database, version pinned below) and reads the SQLite it ships.
huggingface.co direct file downloads and api.github.com are proxy-blocked in
this environment; the npm registry is not, which is how the database is got.

SOURCE  Shabad OS `@shabados/database` 4.8.7, build/database.sqlite.
  LICENCE: the project's docs/licensing.md says of Gurbani "we identify it as
  being free of known restrictions under copyright law" and places the `data`
  and `build` folders -- "including the `gurmukhi` JSON and SQLite fields" --
  under the Creative Commons PUBLIC DOMAIN MARK 1.0. The field this label reads
  is exactly `lines.gurmukhi`. Code is GPL-3, translations/transliterations are
  CC BY-SA; neither is touched here. This label AND its text are admissible.

POOL (negative universe)   `lines`, 141,264 rows across ten sources that
  actually carry text: Sri Guru Granth Sahib 60,555; Sri Dasam Granth 67,758;
  Vaaran Bhai Gurdas 7,585; Kabit Savaiye 2,761; Bhai Nand Lal's four Persian
  works 2,510; Ardaas 17; Sarabloh Granth 78. (`sources` lists twelve; Rehitname
  and Uggardanti ship zero lines.)
  NOT EVERY ROW IS A LINE OF POETRY. `line_types` splits the table into
  Pankti 125,314, Sirlekh 9,902, Rahao 5,406, Manglacharan 642. Sirlekh rows are
  HEADINGS -- 'dohrw ]', 'cOpeI ]', 'mÚ 5 ]' -- and 1,733 rows carry the single
  heading 'dohrw'. Counting them as poems inflates the pool by 8% and, worse,
  manufactures a fake subset leak: 97% of the duplicate-text rows in the full
  table are repeated headings, not repeated verse. Both pools are therefore
  reported, and `is_verse` marks the Pankti+Rahao analysis pool of 130,720.

POSITIVE   membership in any of the 29 banis in `banis`, via `bani_lines`
  (9,424 rows -> 8,387 distinct line ids). A bani is a liturgically fixed
  selection recited daily; the rest of the scripture is read but not recited as
  a set text. label_value = how many banis contain the line (0..6).
  CAUTION on the grading: the 29 are not 29 independent selectors. Rehras
  Sahib (S.) and (T.), Anand Sahib and its 6-pauri form, Aarti and Aarti
  (Longer), and the two Tav Prasad Savaiye are variant recensions of one bani,
  so a count of 2 or 3 often means one selection, recorded twice. Use
  label_binary unless you have grouped them.

JOIN KEY: `join_key` = `lines.id`, the shipped 4-character primary key that
  `bani_lines`, `shabads` and `transliterations` all join on. Text is NOT the
  join key here; the pool ships stable ids. The normalised text key is carried
  separately as `dedup_key` and is what the leak closure clusters on.

EXACT vs NORMALISED   `lines.gurmukhi` is the legacy ASCII font encoding, not
  Unicode Gurmukhi (']' is the danda, ';' ',' '.' are the three Shabad OS
  vishraam pause levels, digits are verse numbers). Case is significant -- it
  selects a different glyph -- so it is NOT folded.
    exact       whitespace collapsed, nothing else
    normalised  vishraam marks, dandas, digits and spaces deleted
    loose       normalised + tippi/bindi nasal glyphs folded (N,micro,circumflex
                -> M). Buys exactly ZERO extra matches; reported so the reader
                can see the normalisation is already at its useful limit.
  The gap is measured on the leak itself, below.

SUBSET LEAK AND ITS CLOSURE
  The banis are cut FROM this pool, so every positive is a pool row -- the
  textbook subset leak. But the id-level version is not the problem, because
  bani_lines points at pool ids and labelling them is exact. The real leak is
  TEXTUAL: the same line of Gurbani occurs at several distinct line ids, once
  inside a bani and again in its raga home. Jap Ji's 'soeI soeI sdw scu
  swihbu' is also SGGS Raag Asa; four lines of Jaap Sahib recur elsewhere in
  the Dasam Granth. Those second copies sit in the negative class as the very
  text the positive class is made of.
  Closure clusters the pool on `dedup_key` and emits one row per cluster with
  label = max over the cluster. Rows moved are printed for both pools and for
  all three key strategies, because the choice of key IS the size of the leak.
"""
import collections, csv, hashlib, io, os, re, sqlite3, sys, tarfile, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
VERSION = '4.8.7'
TARBALL = ('https://registry.npmjs.org/@shabados/database/-/'
           'database-%s.tgz' % VERSION)
CACHE = os.path.join(HERE, '.shabados_cache')
DB = os.path.join(CACHE, 'database-%s.sqlite' % VERSION)

VERSE_TYPES = (3, 4)                      # Rahao, Pankti
STRIP = set('[];,. 0123456789\t\n\r')     # dandas, vishraam, verse numbers
NASAL = {'N': 'M', 'µ': 'M', 'ˆ': 'M'}


def fetch_db():
    if os.path.exists(DB) and os.path.getsize(DB) > 1_000_000:
        return DB
    os.makedirs(CACHE, exist_ok=True)
    blob = urllib.request.urlopen(TARBALL).read()
    with tarfile.open(fileobj=io.BytesIO(blob), mode='r:gz') as tf:
        m = tf.extractfile('package/build/database.sqlite')
        with open(DB, 'wb') as fh:
            while True:
                chunk = m.read(1 << 22)
                if not chunk:
                    break
                fh.write(chunk)
    return DB


def key_exact(s):
    return re.sub(r'\s+', ' ', s).strip()


def key_norm(s):
    return ''.join(c for c in s if c not in STRIP)


def key_loose(s):
    return ''.join(NASAL.get(c, c) for c in key_norm(s))


def leak_report(rows, positives, label):
    """rows: [(line_id, gurmukhi)] -> print the leak under all three keys."""
    print('  %s: %d rows, %d positive' % (label, len(rows), len(positives)))
    out = {}
    for name, fn in (('exact', key_exact), ('normalised', key_norm),
                     ('loose', key_loose)):
        d = collections.defaultdict(list)
        for lid, g in rows:
            d[fn(g)].append(lid)
        neg_twin = clusters = 0
        for ids in d.values():
            if len(ids) > 1 and any(i in positives for i in ids):
                neg = [i for i in ids if i not in positives]
                neg_twin += len(neg)
                clusters += 1 if neg else 0
        print('    %-11s distinct %7d  duplicate rows %6d  NEGATIVE rows that '
              'are a positive\'s text %5d in %d clusters'
              % (name, len(d), len(rows) - len(d), neg_twin, clusters))
        out[name] = (len(d), len(rows) - len(d), neg_twin)
    e, n = out['exact'][2], out['normalised'][2]
    if n:
        print('    exact keying finds %d of the %d leaking rows -- it UNDER-COUNTS'
              ' the leak by %.1f%%' % (e, n, 100.0 * (n - e) / n))
    return out


def main():
    con = sqlite3.connect(fetch_db())
    q = lambda s: con.execute(s).fetchall()

    banis = dict(q('select id, name_english from banis'))
    types = dict(q('select id, name_english from line_types'))
    srcname = dict(q('select id, name_english from sources'))
    shabad_src = dict(q('select id, source_id from shabads'))
    memb = collections.defaultdict(set)
    for lid, bid in q('select line_id, bani_id from bani_lines'):
        memb[lid].add(bid)

    lines = q('select id, shabad_id, gurmukhi, type_id, source_page, source_line '
              'from lines')
    print('SOURCE  @shabados/database %s   lines %d   banis %d   bani_lines %d'
          % (VERSION, len(lines), len(banis), sum(len(v) for v in memb.values())))
    print('  distinct line ids in >=1 bani: %d' % len(memb))
    print('  line_types', dict(collections.Counter(types[r[3]] for r in lines)))

    rows = []
    for lid, sid, g, tid, page, sline in lines:
        b = sorted(memb.get(lid, ()))
        kn = key_norm(g)
        rows.append({
            'poem_id': 'shabados:%s' % lid,
            'label_value': len(b),
            'join_key': lid,
            'label_binary': int(bool(b)),
            'banis': ','.join(banis[x] for x in b) or '-',
            'bani_ids': ','.join(str(x) for x in b) or '-',
            'is_verse': int(tid in VERSE_TYPES),
            'line_type': types[tid],
            'source': srcname[shabad_src[sid]],
            'shabad_id': sid, 'source_page': page, 'source_line': sline,
            'dedup_key': kn,
            'dedup_key_sha1': hashlib.sha1(kn.encode()).hexdigest()[:16],
            'gurmukhi': g,
        })

    pos_all = {r['join_key'] for r in rows if r['label_value']}
    print('\nGRADED DISTRIBUTION (bani count, positives only)',
          dict(sorted(collections.Counter(
              r['label_value'] for r in rows if r['label_value']).items())))
    print('positives by line_type',
          dict(collections.Counter(r['line_type'] for r in rows if r['label_value'])))

    print('\nSUBSET LEAK, measured under three keys')
    leak_report([(r['join_key'], r['gurmukhi']) for r in rows], pos_all,
                'FULL shipped pool')
    verse = [r for r in rows if r['is_verse']]
    pos_v = {r['join_key'] for r in verse if r['label_value']}
    leak_report([(r['join_key'], r['gurmukhi']) for r in verse], pos_v,
                'VERSE pool (Pankti+Rahao)')
    print('  the full-pool figure is 97% repeated HEADINGS ("dohrw ]" 1,733 rows,')
    print('  "cOpeI ]" 1,610, "mÚ 5 ]" 489). The verse-pool figure is the real leak.')

    # ------------------------------------------------------------- closure
    cl = collections.OrderedDict()
    for r in verse:
        cl.setdefault(r['dedup_key'], []).append(r)
    ded = []
    moved_pos_twin = 0
    for k, grp in cl.items():
        # after clustering the unit is the TEXT, so the label is the UNION of the
        # banis its copies sit in, not the max over copies: 'Awid scu jugwid scu'
        # is one line of Gurbani that Jap Ji and Sukhmani Sahib both take.
        ids = sorted({int(x) for g in grp for x in g['bani_ids'].split(',')
                      if x != '-'})
        lab = len(ids)
        best = max(grp, key=lambda g: (g['label_value'], g['join_key']))
        rep = best.copy()
        rep['label_value'] = lab
        rep['bani_ids'] = ','.join(str(i) for i in ids) or '-'
        rep['banis'] = ','.join(banis[i] for i in ids) or '-'
        rep['label_binary'] = int(lab > 0)
        rep['n_pool_rows_collapsed'] = len(grp)
        rep['collapsed_ids'] = ';'.join(g['join_key'] for g in grp
                                        if g['join_key'] != best['join_key']) or '-'
        if lab:
            moved_pos_twin += sum(1 for g in grp if not g['label_value'])
        ded.append(rep)
    print('\nLEAK CLOSURE (on the verse pool)')
    print('  rows in                     %7d' % len(verse))
    print('  clusters out                %7d' % len(ded))
    print('  rows absorbed               %7d' % (len(verse) - len(ded)))
    print('  of those, NEGATIVE rows carrying a positive\'s exact text, which')
    print('  would otherwise have trained against their own positive: %d'
          % moved_pos_twin)
    print('  positives %d  negatives %d'
          % (sum(1 for d in ded if d['label_value']),
             sum(1 for d in ded if not d['label_value'])))

    for fn, data, extra in [('label_pa_bani.tsv', rows, []),
                            ('label_pa_bani.dedup.tsv', ded,
                             ['n_pool_rows_collapsed', 'collapsed_ids'])]:
        cols = ['poem_id', 'label_value', 'join_key', 'label_binary', 'banis',
                'bani_ids', 'is_verse', 'line_type', 'source', 'shabad_id',
                'source_page', 'source_line', 'dedup_key_sha1'] + extra + ['gurmukhi']
        with open(os.path.join(HERE, fn), 'w', encoding='utf-8', newline='') as fh:
            w = csv.DictWriter(fh, fieldnames=cols, delimiter='\t',
                               extrasaction='ignore', lineterminator='\n')
            w.writeheader(); w.writerows(data)
        print('  wrote', fn, len(data), 'rows')


if __name__ == '__main__':
    main()

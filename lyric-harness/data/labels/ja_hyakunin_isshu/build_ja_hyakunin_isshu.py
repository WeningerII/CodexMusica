#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the ja survival label: 小倉百人一首 (Teika, c.1235) over the 八代集.

REPRODUCIBLE END-TO-END. Run from anywhere; it fetches both sources itself.

POOL (negative universe)
  borh/hachidaishu -> hachidai.db, the Hachidaishu vocabulary dataset
  (Yamamoto 2021, Zenodo 10.5281/zenodo.4744170), a token-level morphological
  encoding of the eight imperial waka anthologies taken from the 二十一代集
  (NIJL 200007092). 9,499 poems: 古今集 1111, 後撰集 1426, 拾遺集 1351,
  後拾遺集 1219, 金葉集 712, 詞花集 413, 千載集 1286, 新古今集 1981.

POSITIVE
  nyoronjp/Ogura_Hyakunin_Isshu.csv (Shift-JIS), 100 poems with both the
  漢字仮名交じり text and a 歴史的仮名遣い reading. No romaji, no translation.

JOIN KEY: a normalised kana key, NOT the written body text. Classical waka is
  copied in wildly different orthographies; an anthology manuscript and the
  karuta text of the same poem almost never agree character-for-character.
  Exact hashing of the written form matches 0 of 94.

POOL TEXT NEEDS REPAIR BEFORE KEYING
  1. token slots: A/B/D are tokens, C/E are breakdowns of B/D, and the 2-digit
     suffix enumerates alternative SEMANTIC readings of the same slot. Naive
     row concatenation duplicates text.
  2. editorial apparatus: POS 77 / BG-16-0077 marks '＊ base ＊N variant イ'
     spans on 559 poems. The 異文 must be dropped or the poem gains ~5 morae.
  3. 'ね/ね' notation on 553 rows, '音/根' kakekotoba gloss on 2.
  4. 47 poems where the analyst left kanji in the reading column, recovered
     from the manuscript surface column. 2 (04:000907, 08:000968) carry 告 in
     both columns and stay 1 char short; both are negatives.

LEAK CLOSURE
  The 94 selected poems SIT INSIDE the 9,499-poem pool. Labelling them positive
  while leaving them in the negative pool is the subset leak. Closure removes
  every pool row in a positive's duplicate cluster, not merely the row the match
  named: 94 poems -> 95 rows (#20 is in both 後撰集 961 and 拾遺集 766) -> 96 rows
  once a near-duplicate sweep catches 拾遺集 449 'たきのいとは', the same poem as
  千載集 1033 'たきのおとは' under a one-character variant. An exact-key sweep
  leaves that row sitting in the negatives.
"""
import collections, csv, json, os, re, unicodedata, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
POOL_URL = 'https://raw.githubusercontent.com/borh/hachidaishu/master/hachidai.db'
POS_URL = ('https://raw.githubusercontent.com/nyoronjp/Ogura_Hyakunin_Isshu.csv/'
           'master/%E5%B0%8F%E5%80%89%E7%99%BE%E4%BA%BA%E4%B8%80%E9%A6%96.csv')
ANTH = {'01': ('kokinshu', '古今集'), '02': ('gosenshu', '後撰集'),
        '03': ('shuishu', '拾遺集'), '04': ('goshuishu', '後拾遺集'),
        '05': ('kinyoshu', '金葉集'), '06': ('shikashu', '詞花集'),
        '07': ('senzaishu', '千載集'), '08': ('shinkokinshu', '新古今集')}
ORDER = {k: int(k) for k in ANTH}
# 出典 of the six poems with no member of the pool, and the published tabulation
# of the other 94, used below as an external check on the matching.
LATER = {93: '新勅撰集', 96: '新勅撰集', 97: '新勅撰集', 98: '新勅撰集',
         99: '続後撰集', 100: '続後撰集'}
EXPECTED = {'古今集': 24, '後撰集': 7, '拾遺集': 11, '後拾遺集': 14,
            '金葉集': 5, '詞花集': 5, '千載集': 14, '新古今集': 14}

# --------------------------------------------------------------- normalisation
_DAKU = {}
for _p in ("がか ぎき ぐく げけ ごこ ざさ じし ずす ぜせ ぞそ だた ぢち づつ でて どと "
           "ばは びひ ぶふ べへ ぼほ ぱは ぴひ ぷふ ぺへ ぽほ ゔう").split():
    _DAKU[_p[0]] = _p[1]
_SMALL = {'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お', 'っ': 'つ',
          'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'ゎ': 'わ', 'ゕ': 'か', 'ゖ': 'け'}
_KANA = re.compile(r'[ぁ-ゖ]')


def is_kana(v):
    return bool(v) and all('ぁ' <= c <= 'ゖ' for c in v)


def key_exact(s):
    """Whitespace removed only. This is 'exact body-text hashing'."""
    return re.sub(r'\s+', '', unicodedata.normalize('NFC', s))


def key_norm(s):
    """NFKC -> katakana to hiragana -> expand ゝゞ iteration marks -> strip
    dakuten/handakuten -> small kana to full -> fold the historical-kana
    variants ゐ->い ゑ->え を->お ん->む -> drop every non-hiragana codepoint
    (punctuation, whitespace, line breaks, stray kanji)."""
    s = unicodedata.normalize('NFKC', s)
    s = ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)
    out = []
    for c in s:
        if c in 'ゝヽ々ゞヾ' and out:
            prev = out[-1]
            out.append(_DAKU.get(prev, prev))
        else:
            out.append(c)
    s = ''.join(out)
    s = ''.join(_DAKU.get(c, c) for c in s)
    s = ''.join(_SMALL.get(c, c) for c in s)
    s = s.replace('ゐ', 'い').replace('ゑ', 'え').replace('を', 'お').replace('ん', 'む')
    return ''.join(c for c in s if _KANA.match(c))


def lev(a, b):
    if a == b:
        return 0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def grams(s, n=3):
    return {s[i:i + n] for i in range(max(1, len(s) - n + 1))}


# ------------------------------------------------------------------- ingestion
def fetch(url, dest, decode=None):
    if not os.path.exists(dest):
        with urllib.request.urlopen(url, timeout=180) as r:
            raw = r.read()
        if decode:
            raw = raw.decode(decode).encode('utf-8')
        open(dest, 'wb').write(raw)
    return dest


def unslash(v):
    if '/' not in v:
        return v
    a, b = v.split('/', 1)
    return a if a == b else a


def build_pool(dbpath):
    raw, seen = collections.OrderedDict(), set()
    for line in open(dbpath, encoding='utf-8'):
        p = line.split()
        if len(p) != 9:
            continue
        anth, num, tok = p[0].split(':')
        if p[1][0] in ('C', 'E') or (anth, num, tok) in seen:
            continue          # breakdown row, or alternative reading of a slot
        seen.add((anth, num, tok))
        raw.setdefault((anth, num), []).append(p)

    def kana_of(p):
        v = unslash(p[8])
        if is_kana(v):
            return v
        alt = unslash(p[4])   # analyst left kanji in the reading column
        return alt if is_kana(alt) else v

    pool = []
    for (anth, num), toks in raw.items():
        toks.sort(key=lambda x: x[0])
        base, var, state = [], [], 'BASE'
        for p in toks:
            app = p[3] == '77' and p[2].startswith('BG-16-0077')
            if p[3] == '77' and p[2].startswith('BG-16-008'):
                continue      # 〈 〉 （ ） brackets: drop marker, keep content
            if app:
                s = p[4]
                state = 'VAR' if (s.startswith('＊') and s != '＊') else 'BASE'
                continue
            (base if state == 'BASE' else var).append(p)
        rec = {'poem_id': 'hachidai:%s:%s' % (anth, num), 'anthology_code': anth,
               'anthology': ANTH[anth][0], 'anthology_ja': ANTH[anth][1],
               'poem_no': int(num),
               'surface': ''.join(unslash(t[4]) for t in base),
               'kanji': ''.join(unslash(t[7]) for t in base),
               'kana': ''.join(kana_of(t) for t in base)}
        if var:
            rec['variant_kana'] = ''.join(kana_of(t) for t in var)
        rec['k_exact'] = key_exact(rec['kana'])
        rec['k_norm'] = key_norm(rec['kana'])
        pool.append(rec)
    return pool


# ----------------------------------------------------------------------- main
def main():
    pool = build_pool(fetch(POOL_URL, os.path.join(HERE, 'hachidai.db')))
    pos = list(csv.DictReader(open(
        fetch(POS_URL, os.path.join(HERE, 'hyakunin_isshu.csv'), decode='cp932'),
        encoding='utf-8')))
    assert len(pool) == 9499 and len(pos) == 100
    byid = {r['poem_id']: r for r in pool}

    idx = {f: collections.defaultdict(list) for f in
           ('surface_x', 'kanji_x', 'kana_x', 'kana_n')}
    for r in pool:
        idx['surface_x'][key_exact(r['surface'])].append(r['poem_id'])
        idx['kanji_x'][key_exact(r['kanji'])].append(r['poem_id'])
        idx['kana_x'][r['k_exact']].append(r['poem_id'])
        idx['kana_n'][r['k_norm']].append(r['poem_id'])
    inv = collections.defaultdict(list)
    for i, r in enumerate(pool):
        for g in grams(r['k_norm']):
            inv[g].append(i)

    rungs = collections.defaultdict(dict)
    matches = {}
    for p in pos:
        n = int(p['No'])
        written = key_exact(p['上の句'] + p['下の句'])
        kana = key_exact(p['上の句（ひらがな）'] + p['下の句（ひらがな）'])
        knorm = key_norm(p['上の句（ひらがな）'] + p['下の句（ひらがな）'])
        rungs['K0'][n] = idx['surface_x'].get(written, [])
        rungs['K0b'][n] = idx['kanji_x'].get(written, [])
        rungs['K1'][n] = idx['kana_x'].get(kana, [])
        rungs['K2'][n] = idx['kana_n'].get(knorm, [])
        if rungs['K2'][n]:
            matches[n] = (list(rungs['K2'][n]), 'K2_normalised_identical', 0)
            continue
        cnt = collections.Counter()
        for g in grams(knorm):
            for i in inv[g]:
                cnt[i] += 1
        scored = sorted((lev(knorm, pool[i]['k_norm']), i)
                        for i, _ in cnt.most_common(60))
        d, gap = scored[0][0], scored[1][0] - scored[0][0]
        # accept on SEPARATION, not on a bare threshold: the distance profile is
        # bimodal (in-pool 1-5 with runner-up 17-23; out-of-pool 16-22 with
        # runner-up 0-5 away, i.e. indistinguishable from the noise floor).
        if d <= 5 and gap >= 10:
            matches[n] = ([pool[scored[0][1]]['poem_id']],
                          'K3_normalised_plus_variant', d)

    # leak closure: expand each match to its full duplicate cluster
    clusters = {}
    for n, (ids, _, _) in matches.items():
        cl = set(ids)
        for pid in list(ids):
            r = byid[pid]
            cnt = collections.Counter()
            for g in grams(r['k_norm']):
                for i in inv[g]:
                    cnt[i] += 1
            for i, _ in cnt.most_common(20):
                o = pool[i]
                if o['poem_id'] not in cl and lev(r['k_norm'], o['k_norm']) <= 3:
                    cl.add(o['poem_id'])
        clusters[n] = sorted(cl, key=lambda x: ORDER[byid[x]['anthology_code']])
    positive_ids = {pid for cl in clusters.values() for pid in cl}
    hn = {pid: n for n, cl in clusters.items() for pid in cl}

    # ---- emit
    with open(os.path.join(HERE, 'crosswalk_hyakunin_to_hachidaishu.tsv'), 'w',
              encoding='utf-8', newline='') as f:
        w = csv.writer(f, delimiter='\t')
        w.writerow(['hyakunin_no', 'poet', 'teika_text', 'teika_kana', 'join_key',
                    'in_pool', 'match_rung', 'edit_distance', 'pool_poem_id',
                    'anthology_ja', 'poem_no', 'pool_kana', 'duplicate_pool_ids',
                    'not_in_pool_reason'])
        for p in pos:
            n = int(p['No'])
            kana = key_exact(p['上の句（ひらがな）'] + p['下の句（ひらがな）'])
            knorm = key_norm(p['上の句（ひらがな）'] + p['下の句（ひらがな）'])
            if n in clusters:
                pr = byid[clusters[n][0]]
                w.writerow([n, p['歌人'], p['上の句'] + p['下の句'], kana, knorm, 1,
                            matches[n][1], matches[n][2], pr['poem_id'],
                            pr['anthology_ja'], pr['poem_no'], pr['kana'],
                            ';'.join(clusters[n][1:]), ''])
            else:
                w.writerow([n, p['歌人'], p['上の句'] + p['下の句'], kana, knorm, 0,
                            'no_match', '', '', '', '', '', '',
                            'source is %s, compiled after the 八代集 closed '
                            '(新古今集 1205)' % LATER[n]])

    dupgrp = collections.defaultdict(list)
    for r in pool:
        dupgrp[r['k_norm']].append(r['poem_id'])
    with open(os.path.join(HERE, 'label_hyakunin_isshu.tsv'), 'w',
              encoding='utf-8', newline='') as f:
        w = csv.writer(f, delimiter='\t')
        w.writerow(['poem_id', 'label_value', 'join_key', 'anthology',
                    'anthology_ja', 'poem_no', 'kana', 'surface', 'hyakunin_no',
                    'dup_of'])
        for r in pool:
            w.writerow([r['poem_id'], 1 if r['poem_id'] in positive_ids else 0,
                        r['k_norm'], r['anthology'], r['anthology_ja'],
                        r['poem_no'], r['kana'], r['surface'],
                        hn.get(r['poem_id'], ''),
                        ';'.join(x for x in dupgrp[r['k_norm']]
                                 if x != r['poem_id'])])

    seen, dedup = set(), []
    for r in pool:
        n = hn.get(r['poem_id'])
        gid = 'pos:%s' % n if n else 'txt:%s' % r['k_norm']
        if gid in seen:
            continue
        seen.add(gid)
        ids = clusters[n] if n else dupgrp[r['k_norm']]
        dedup.append((r, len(ids)))
    with open(os.path.join(HERE, 'label_hyakunin_isshu.dedup.tsv'), 'w',
              encoding='utf-8', newline='') as f:
        w = csv.writer(f, delimiter='\t')
        w.writerow(['poem_id', 'label_value', 'join_key', 'anthology_ja',
                    'poem_no', 'kana', 'n_pool_rows_collapsed'])
        for r, k in dedup:
            w.writerow([r['poem_id'], 1 if r['poem_id'] in positive_ids else 0,
                        r['k_norm'], r['anthology_ja'], r['poem_no'], r['kana'], k])

    # ---- report
    inpool = [n for n in range(1, 101) if n in clusters]
    print('pool rows %d | positives %d/100 | positive pool rows %d | negatives %d'
          % (len(pool), len(clusters), len(positive_ids),
             len(pool) - len(positive_ids)))
    for k, lbl in [('K0', 'K0  exact written body text (manuscript surface)'),
                   ('K0b', 'K0b exact written body text (lemma-kanji)'),
                   ('K1', 'K1  exact kana reading string'),
                   ('K2', 'K2  normalised kana key')]:
        h = sum(1 for n in inpool if rungs[k][n])
        print('  %-48s %2d/94  %5.1f%%' % (lbl, h, 100 * h / 94))
    print('  %-48s %2d/94  100.0%%'
          % ('K3  normalised + bounded variant tolerance', len(inpool)))
    dist = collections.Counter(byid[clusters[n][0]]['anthology_ja'] for n in inpool)
    ok = all(dist.get(a, 0) == e for a, e in EXPECTED.items())
    print('  per-anthology vs published tabulation: %s  %s'
          % (dict(dist), 'VALIDATED' if ok else 'MISMATCH'))
    assert ok, 'per-anthology distribution does not match the published tabulation'


if __name__ == '__main__':
    main()

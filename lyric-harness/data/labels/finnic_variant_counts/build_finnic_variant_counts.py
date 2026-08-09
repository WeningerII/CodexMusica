#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the Finnic type-index survival labels as joinable tables.

TWO CONTINUOUS LABELS, per poem:
  L1  variant_count   -- how many OTHER poems in the corpus attest the same
                         song type (leave-one-out, over deduplicated texts).
  L2  parish_spread   -- how many DISTINCT PARISHES those other attestations
                         come from (leave-one-out).

Both measure retransmission, not editorial opinion. A type attested in 1,628
other variants across 349 parishes demonstrably survived oral transmission; a
type attested once, in one parish, did not. L2 is not a proxy for L1: a type
can be sung 400 times in one parish (a single singer's repertoire recorded
repeatedly) or 40 times across 40 parishes, and only the second is evidence of
transmission across communities.

SOURCES
  hsci-r/filter-data (main)  -- the harmonised Finnic corpus: SKVR + ERAB +
      JR + Kalevala/Kanteletar, 294,367 poem records. Big tables are Git LFS;
      the anonymous git lane does not serve LFS objects, so they are pulled
      from media.githubusercontent.com/media/... instead of raw.github....
  rahvaluule/erab (main)     -- ERAB source. Needed for two things FILTER does
      not expose: the raw unified-type table hierarhia.csv (which still carries
      the disposal bucket), and xml/ vs xml_koll/ -- the SAME 108,969 texts in
      normalised and in original collection orthography, which is the
      re-printing pair used to price exact against normalised matching.

CLEANUP (all four diagnosed before this build; all four enforced here)
  C1  ERAB unified type id 1, kood 999999999, ' - Jaab ara - '.
      A DISPOSAL BUCKET: entries marked for removal from the index. 1,270 links
      in the ERAB source, and the top of the unfiltered ERAB ranking -- which
      is exactly where the discredited "~1,270 max variants" headline came
      from. FILTER already drops it (65,028 erab links vs 66,298 in source, a
      difference of exactly 1,270). Verified and asserted here, not assumed.
  C2  ERAB unified type id 1347, kood 017002025, 'Maaramata' (= "undetermined"),
      under erab_017002 'Omalooming' (non-traditional own-composition). An
      ADMINISTRATIVE PLACEHOLDER: it records that the indexer could not assign
      a type. 335 links. FILTER does NOT drop it. Dropped here.
  C3  erab_orig* -- 14,827 pseudo-types carrying 81,040 links, 40% of all links
      in the release. Not a type index: FILTER mints one node per DISTINCT
      ORIGINAL TYPE-NAME STRING found on an Estonian song (ERAB's
      hierarhia_originaal.csv, 81,041 rows), so every Estonian song is linked
      BOTH to its real unified type AND to a free-text restatement of it.
      Counting the union double-counts every Estonian attestation, and because
      the strings are unnormalised the same type shatters across spellings
      ('Kubjas, ara loo!' / 'Kubjas ara loo' / 'Kubjas, ara loo'). Dropped.
  C4  kt_t* -- 60 nodes, 676 links, and they are the TABLE OF CONTENTS of the
      Kanteletar ('I. Tyttoin lauluja', 'Tansseissa ja kisoissa'), i.e. book
      sections, not song types. Rejected on the same ground as Thirukkural
      paal/iyal: one book's own chapter list separates nothing.
  C5  FOUND BY THIS BUILD, not handed to it. The previously published spread
      figure -- "max 362 parishes, mean 8.13, 3,216 of 7,555 types in a single
      parish" -- counted every row of poem_place.csv as a parish. It is not a
      parish table: places.csv carries 861 parishes AND 41 COUNTIES, and a poem
      localised only to a county ('Viena', 'Virumaa') contributed a phantom
      parish. Reproduced exactly here (see parish_measure_audit) and corrected
      by restricting to place_type == 'parish': max 362 -> 349, mean 8.128 ->
      7.784, single-parish types 3,216 -> 3,097, on the identical universe.

MATCHING -- EXACT vs NORMALISED, PRICED, NOT ASSERTED
  The label's own join is by native poem id and is exact and lossless: the type
  link is an id-to-id link inside one harmonised release. The matching cost
  lands one step earlier, in DEDUPLICATION -- before a type's variants can be
  counted, re-entries of the same physical text must be collapsed, and that is
  a text-matching problem. It is priced twice over:
    (a) against ground truth, on ERAB xml/ vs xml_koll/ (same 108,969 texts,
        two orthographies, ids known) -- see ortho_gap();
    (b) on the label itself: every count is computed once under an exact
        body-text key and once under a normalised key, and both are written to
        every row, so the cost of the choice is visible per poem and not just
        in aggregate.

LEAK CLOSURE -- see close_leak.__doc__ and emit().
"""
import collections, csv, hashlib, json, os, re, sys, unicodedata, urllib.request

csv.field_size_limit(10 ** 9)
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get('FINNIC_CACHE', '/tmp/finnic_cache')
ERAB = os.environ.get('ERAB_ROOT', '/workspace/erab')
LFS = 'https://media.githubusercontent.com/media/hsci-r/filter-data/main/'
RAW = 'https://raw.githubusercontent.com/hsci-r/filter-data/main/'
LFS_TABLES = {'poem_types.csv', 'types.csv', 'poem_place.csv', 'places.csv', 'verses.csv'}


def fetch(name):
    os.makedirs(CACHE, exist_ok=True)
    dst = os.path.join(CACHE, name)
    if not os.path.exists(dst) or os.path.getsize(dst) == 0:
        url = (LFS if name in LFS_TABLES else RAW) + name
        sys.stderr.write('fetching %s\n' % url)
        urllib.request.urlretrieve(url, dst)
    return dst


def rows(name):
    with open(fetch(name), newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            yield r


# ----------------------------------------------------------------- normalisers
_PUNCT = re.compile(r'[^\w]', re.U)
_DIGIT = re.compile(r'\d+')
# Variant characters actually attested in these corpora: y for u-umlaut is the
# 19th-c. Estonian/Finnish convention, w for v the Fraktur convention, and the
# acute is a palatalisation mark the normalised printing simply drops.
_VAR = str.maketrans({'y': 'ü', 'w': 'v', 'ō': 'õ', 'ǒ': 'õ',
                      'ń': 'n', 'ḱ': 'k', 'ĺ': 'l', 'ŕ': 'r',
                      'ś': 's', 'ź': 'z', 'ť': 't', 'ď': 'd',
                      'ǵ': 'g', 'ṕ': 'p', 'ḿ': 'm', 'ǝ': 'e'})


def key_exact(s):
    """Exact body text. The strawman, kept so its cost stays measurable."""
    return s


def key_norm(s):
    """Strip case, punctuation, digits and ALL whitespace; fold variant chars.

    Whitespace must go, not merely collapse: the two ERAB printings disagree on
    word division itself ('Kus su' / 'Kussu', 'Kus see' / 'Kusse'), and line
    breaks move when an editor re-lineates a runo. Digits go because SKVR
    interleaves every-fifth-line numbers and folio marks into the verse text.
    """
    s = unicodedata.normalize('NFC', s).lower()
    s = _PUNCT.sub('', s)
    s = _DIGIT.sub('', s)
    return s.translate(_VAR).replace('ŋ', 'ng')


def h(s):
    return hashlib.sha1(s.encode('utf-8')).hexdigest()[:16]


MINLEN = 30      # a normalised key shorter than this is not evidence of identity


# --------------------------------------------- exact vs normalised, vs truth
_ITEM = re.compile(r'<ITEM nro="([^"]+)"[^>]*>(.*?)</ITEM>', re.S)
_TEXT = re.compile(r'<TEXT>(.*?)</TEXT>', re.S)
_V = re.compile(r'<V>(.*?)</V>', re.S)


def _unesc(s):
    return (s.replace('&amp;lt;', '<').replace('&amp;gt;', '>').replace('&lt;', '<')
             .replace('&gt;', '>').replace('&amp;', '&').replace('&quot;', '"'))


def ortho_gap():
    """Price exact against normalised matching on a REAL re-printing pair.

    ERAB ships every one of its 108,969 texts twice: xml/ normalised by
    orthography, xml_koll/ in the orthography of the original collection. Same
    poem, same id, two printings -- so ground truth is known for every pair and
    a matcher's recall is measured, not estimated. Returns None if the ERAB
    clone is absent; only this diagnostic needs it, not the label build.
    """
    import glob
    if not os.path.isdir(os.path.join(ERAB, 'xml')):
        return None

    def load(d):
        out = {}
        for fn in sorted(glob.glob(os.path.join(ERAB, d, '*.xml'))):
            raw = open(fn, encoding='utf-8').read()
            for m in _ITEM.finditer(raw):
                t = _TEXT.search(m.group(2))
                out[m.group(1)] = ('\n'.join(_unesc(v.group(1)).strip()
                                             for v in _V.finditer(t.group(1))) if t else '')
        return out

    a, b = load('xml'), load('xml_koll')
    ids = [i for i in set(a) & set(b) if a[i].strip() and b[i].strip()]
    out = {'true_pairs': len(ids)}
    for name, fn in (('exact', key_exact), ('normalised', key_norm)):
        idx = collections.defaultdict(set)
        for i in ids:
            idx[fn(b[i])].add(i)
        out[name + '_recovered'] = sum(1 for i in ids if i in idx.get(fn(a[i]), ()))
        out[name + '_ambiguous'] = sum(1 for i in ids if len(idx.get(fn(a[i]), ())) > 1)
        out[name + '_recall_pct'] = round(100.0 * out[name + '_recovered'] / len(ids), 2)
    out['exact_undercount_vs_normalised_pct'] = round(
        100.0 * (out['normalised_recovered'] - out['exact_recovered'])
        / out['normalised_recovered'], 2)
    return out


def erab_source_check():
    """Verify C1 against the ERAB source rather than trusting the diagnosis."""
    p = os.path.join(ERAB, 'csv')
    if not os.path.isdir(p):
        return None
    hier = {r['id']: r for r in csv.DictReader(
        open(os.path.join(p, 'hierarhia.csv'), newline='', encoding='utf-8'))}
    lh = list(csv.DictReader(open(os.path.join(p, 'laul_hierarhia.csv'),
                                  newline='', encoding='utf-8')))
    c = collections.Counter(r['hierarhia_id'] for r in lh)
    top = c.most_common(3)
    orig = sum(1 for _ in csv.DictReader(
        open(os.path.join(p, 'hierarhia_originaal.csv'), newline='', encoding='utf-8')))
    return {
        'source_links_total': len(lh),
        'C1_id1_kood': hier['1']['kood'], 'C1_id1_name': hier['1']['nimi'].strip(),
        'C1_id1_links': c.get('1', 0),
        'C1_is_top_of_unfiltered_ranking': top[0][0] == '1',
        'C1_unfiltered_max_it_produced': top[0][1],
        'C1_true_top_after_drop': [(hier[t]['nimi'], n) for t, n in top[1:2]],
        'C2_id1347_kood': hier['1347']['kood'], 'C2_id1347_name': hier['1347']['nimi'].strip(),
        'C2_id1347_links': c.get('1347', 0),
        'C3_hierarhia_originaal_rows': orig,
    }


# ------------------------------------------------------------------ geography
KRL = {'Viena', 'Aunus', 'Laatokan Karjala (Raja-Karjala)', 'Tveri', 'Novgorodin alue'}
INGRIA = {'Itä- ja Pohjois-Inkeri', 'Keski-Inkeri', 'Länsi-Inkeri'}
VEPS = {'Vepsäläisalueet'}


def language_of(collection, counties):
    """SKVR/JR poems assigned by county; ERAB is Estonian by construction.

    The county partition is the one the corpus itself draws. Viena, Aunus and
    Raja-Karjala are Karelian-speaking; Finland-side Etela-/Pohjois-Karjala are
    Finnish dialect areas and stay in fi. The three Ingrian counties are the
    Izhorian/Votic area -- glossed izh/vot with an explicit caveat carried in
    the README: Keski- and Ita-Inkeri also held Ingrian-FINNISH (Savakko /
    Ayramoinen) settlers, so this cell is an AREA label, not a speaker
    attribution, and any speaker-level claim needs the singer records.
    """
    if collection == 'erab':
        return 'et'
    if not counties:
        return None
    if counties & INGRIA:
        return 'izh_vot'
    if counties & KRL:
        return 'krl'
    if counties & VEPS:
        return 'vep'
    return 'fi'


def close_leak():
    """LEAK CLOSURE, stated once, enforced in three places in the code.

    (1) SELF-COUNT. A variant count is built out of the very poems it labels.
        Poem X, one of N attestations of type T, would be handed the label N --
        a label that contains X. Structurally identical to leaving an
        anthology's poems inside the comprehensive pool they are contrasted
        with: the positive sits inside its own negative universe and the answer
        can be read straight off the item. Closure is leave-one-out, per poem
        and per type. EVERY row moves. Singletons fall 1 -> 0, which is the
        correct statement: nothing else in the corpus repeats this poem's song
        type. Before closure they read 1 and were indistinguishable from a type
        with one other attestation.
    (2) RE-ENTERED TEXTS. Counting is over DEDUPLICATED texts, so one physical
        text entered twice is one attestation. This is where exact vs
        normalised matching bites and both are computed.
    (3) THE COMPILED ANTHOLOGY INSIDE THE POOL. The kr collection (Kalevala 1-50
        + Kanteletar) is Lonnrot's SELECTIVE compilation, assembled out of the
        same oral material the rest of the corpus records comprehensively. Its
        rows are editorial re-workings of poems already in the pool -- 65 of
        them still collide with an SKVR text on the normalised key even after
        Lonnrot's rewriting -- so counting them as independent attestations is
        the anthology-inside-the-pool leak in its literal form. The whole
        collection is removed from the pool, not merely from the label.
    """


# ----------------------------------------------------------------------- main
def main():
    out = {'sources': {'filter_data': 'hsci-r/filter-data@main',
                       'erab': 'rahvaluule/erab@main'}}

    poems = {r['poem_id']: r['collection'] for r in rows('poems.csv')}
    out['pool_all_rows'] = len(poems)
    out['pool_by_collection'] = dict(collections.Counter(poems.values()))

    body = collections.defaultdict(list)
    for r in rows('verses.csv'):
        if r['verse_type'] == 'V':
            body[r['poem_id']].append(r['text'])
    body = {p: '\n'.join(v) for p, v in body.items()}
    out['pool_rows_with_text'] = len(body)

    # ---- type universe and the cleanup -----------------------------------
    types = {r['type_id']: r for r in rows('types.csv')}
    out['types_in_release'] = dict(collections.Counter(
        'erab_orig' if t.startswith('erab_orig') else t.split('_')[0] + '_*'
        for t in types))
    all_links = list(rows('poem_types.csv'))
    out['links_orphan_dropped'] = sum(1 for r in all_links if r['poem_id'] not in poems)
    raw_links = [r for r in all_links if r['poem_id'] in poems]
    out['links_raw'] = len(raw_links)

    DROP = {'erab_017002025'}                                   # C2

    def dirty(t):
        if t.startswith('erab_orig'):
            return 'C3_erab_orig_pseudo_types'
        if t.startswith('kt_t'):
            return 'C4_kanteletar_table_of_contents'
        if t in DROP:
            return 'C2_maaramata_placeholder'
        return None

    removed, links = collections.Counter(), []
    for r in raw_links:
        w = dirty(r['type_id'])
        if w:
            removed[w] += 1
        else:
            links.append(r)
    out['cleanup_links_removed'] = dict(removed)
    out['links_clean'] = len(links)
    out['clean_types_used'] = {
        'skvr': len({r['type_id'] for r in links if r['type_id'].startswith('skvr_t')}),
        'erab': len({r['type_id'] for r in links if r['type_id'].startswith('erab_')}),
    }

    # ---- deduplication, both keys ----------------------------------------
    masters, keys = {}, {}
    for name, fn in (('exact', key_exact), ('normalised', key_norm)):
        idx = collections.defaultdict(list)
        for p, txt in body.items():
            if len(key_norm(txt)) >= MINLEN:
                idx[h(fn(txt))].append(p)
        cl = {k: v for k, v in idx.items() if len(v) > 1}
        m = {}
        for v in cl.values():
            lo = min(v)
            for p in v:
                m[p] = lo
        masters[name] = m
        keys[name] = {p: h(fn(t)) for p, t in body.items()}
        out['dedup_' + name] = {'clusters': len(cl),
                                'rows_in_clusters': sum(len(v) for v in cl.values()),
                                'rows_collapsed': sum(len(v) - 1 for v in cl.values())}
    out['dedup_gap_exact_vs_normalised'] = {
        'extra_clusters_found_by_normalised':
            out['dedup_normalised']['clusters'] - out['dedup_exact']['clusters'],
        'extra_rows_collapsed_by_normalised':
            out['dedup_normalised']['rows_collapsed'] - out['dedup_exact']['rows_collapsed'],
        'exact_undercount_pct': round(
            100.0 * (out['dedup_normalised']['rows_collapsed'] - out['dedup_exact']['rows_collapsed'])
            / out['dedup_normalised']['rows_collapsed'], 2)}

    # FILTER's own curated duplicate list, folded into the normalised key only
    merged = 0
    m = masters['normalised']
    for r in rows('poem_duplicates.csv'):
        a, b = r['poem_id'], r['master_poem_id']
        if a in poems and b in poems:
            ra, rb = m.get(a, a), m.get(b, b)
            if ra != rb:
                lo, hi = sorted((ra, rb))
                for p in [q for q, v in m.items() if v == hi]:
                    m[p] = lo
                m[a] = m[b] = lo
                merged += 1
    out['dedup_curated_pairs_merged'] = merged
    out['dedup_distinct_texts_normalised'] = len({m.get(p, p) for p in poems})

    # ---- geography --------------------------------------------------------
    places = {r['place_id']: r for r in rows('places.csv')}

    def county(pid):
        p = places.get(pid)
        while p is not None and p['place_type'] != 'county':
            p = places.get(p['place_parent_id'])
        return p['place_name'] if p else None

    out['places_in_release'] = dict(collections.Counter(
        p['place_type'] for p in places.values()))
    parishes, counties = collections.defaultdict(set), collections.defaultdict(set)
    anyplace = collections.defaultdict(set)
    for r in rows('poem_place.csv'):
        if r['poem_id'] not in poems:
            continue
        anyplace[r['poem_id']].add(r['place_id'])
        pl = places.get(r['place_id'])
        if pl and pl['place_type'] == 'parish':
            parishes[r['poem_id']].add(r['place_id'])
        c = county(r['place_id'])
        if c:
            counties[r['poem_id']].add(c)

    # C5 audit: reproduce the published figure, then show the corrected one on
    # the identical universe, so the correction is a delta and not an assertion.
    def spread_audit(m):
        d = collections.defaultdict(set)
        for r in raw_links:
            if r['type_id'].startswith('skvr_t'):
                d[r['type_id']] |= m.get(r['poem_id'], set())
        v = [len(x) for x in d.values()]
        return {'types': len(v), 'max': max(v), 'mean': round(sum(v) / float(len(v)), 3),
                'single': sum(1 for x in v if x == 1)}
    out['parish_measure_audit'] = {
        'as_published_any_place_row': spread_audit(anyplace),
        'corrected_place_type_parish_only': spread_audit(parishes)}
    lang = {p: language_of(c, counties.get(p, set())) for p, c in poems.items()}
    out['pool_by_language'] = dict(collections.Counter(
        '%s/%s' % (poems[p], lang[p]) for p in poems))

    # ---- counts under both dedup keys, before and after cleanup ----------
    def tally(link_set, canon, pool_filter):
        tt, tp = collections.defaultdict(set), collections.defaultdict(set)
        for r in link_set:
            p = r['poem_id']
            if not pool_filter(p):
                continue
            tt[r['type_id']].add(canon(p))
            for k in parishes.get(p, ()):
                tp[r['type_id']].add((canon(p), k))
        return ({t: len(v) for t, v in tt.items()},
                {t: len({k for _, k in v}) for t, v in tp.items()}, tt, tp)

    ident = lambda p: p
    canon_n = lambda p: m.get(p, p)
    canon_e = lambda p: masters['exact'].get(p, p)
    in_pool = lambda p: poems[p] != 'kr'           # closure (3)
    all_pool = lambda p: True

    # (i) fully unfiltered, undeduplicated -- the discredited configuration
    v_dirty, pr_dirty, _, _ = tally(raw_links, ident, all_pool)
    # (ii) cleaned types, undeduplicated, kr still in
    v_mid, pr_mid, _, _ = tally(links, ident, all_pool)
    # (iii) cleaned + kr removed + exact dedup
    v_ex, pr_ex, _, _ = tally(links, canon_e, in_pool)
    # (iv) OPERATIVE: cleaned + kr removed + normalised dedup
    v_no, pr_no, type_texts, type_parish = tally(links, canon_n, in_pool)

    def summarise(v, pr):
        d = collections.Counter(v.values())
        top = max(v, key=v.get)
        return {'types': len(v), 'max': v[top], 'argmax': top,
                'argmax_name': types[top]['type_name'],
                'singletons': d[1], 'ge10': sum(n for k, n in d.items() if k >= 10),
                'mean': round(sum(v.values()) / float(len(v)), 3),
                'median': sorted(v.values())[len(v) // 2],
                'parish_max': max(pr.values()), 'parish_mean':
                    round(sum(pr.get(t, 0) for t in v) / float(len(v)), 3)}

    out['configurations'] = {
        'i_unfiltered_undeduplicated': summarise(v_dirty, pr_dirty),
        'ii_types_cleaned_only': summarise(v_mid, pr_mid),
        'iii_cleaned_kr_removed_EXACT_dedup': summarise(v_ex, pr_ex),
        'iv_cleaned_kr_removed_NORMALISED_dedup_OPERATIVE': summarise(v_no, pr_no),
    }
    hist = collections.Counter(v_no.values())
    buckets = [(1, 1), (2, 2), (3, 4), (5, 9), (10, 24), (25, 49), (50, 99),
               (100, 249), (250, 499), (500, 10 ** 9)]
    out['corrected_variant_distribution_per_type'] = {
        ('%d' % lo if lo == hi else '%d-%d' % (lo, hi) if hi < 10 ** 9 else '%d+' % lo):
            sum(n for k, n in hist.items() if lo <= k <= hi) for lo, hi in buckets}
    phist = collections.Counter(pr_no.get(t, 0) for t in v_no)
    out['corrected_parish_spread_per_type'] = {
        ('%d' % lo if lo == hi else '%d-%d' % (lo, hi) if hi < 10 ** 9 else '%d+' % lo):
            sum(n for k, n in phist.items() if lo <= k <= hi) for lo, hi in buckets}

    emit(out, poems, lang, links, canon_n, canon_e, parishes,
         type_texts, type_parish, v_ex, types, keys)

    og = ortho_gap()
    if og:
        out['ortho_gap_ground_truth'] = og
    es = erab_source_check()
    if es:
        out['erab_source_verification'] = es
    with open(os.path.join(HERE, 'build_report.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False, sort_keys=True)
    print(json.dumps(out, indent=2, ensure_ascii=False, sort_keys=True))


def emit(out, poems, lang, links, canon_n, canon_e, parishes,
         type_texts, type_parish, v_ex, types, keys):
    """Write one table per label per language cell. See close_leak.__doc__."""
    poem_links = collections.defaultdict(list)
    for r in links:
        poem_links[r['poem_id']].append(r)

    cells = collections.defaultdict(list)
    leak = collections.Counter()
    for p, coll in poems.items():
        if coll == 'kr':
            leak['closure3_kr_rows_removed_from_pool'] += 1
            continue
        L = lang.get(p)
        ls = poem_links.get(p)
        if L not in ('fi', 'krl', 'et', 'izh_vot') or not ls:
            continue
        # primary type: prefer a non-minor link; among those the best-attested
        pri = [r for r in ls if r['type_is_minor'] == '0'] or ls
        if len(pri) < len(ls):
            leak['minor_type_links_ignored'] += len(ls) - len(pri)
        me_n, me_e = canon_n(p), canon_e(p)
        best = max(((r['type_id'],
                     len(type_texts[r['type_id']] - {me_n}),
                     len({k for c, k in type_parish[r['type_id']] if c != me_n}),
                     len(type_texts[r['type_id']]),
                     v_ex.get(r['type_id'], 0) - (1 if me_e in type_texts[r['type_id']] else 0))
                    for r in pri), key=lambda x: x[1])
        t, v, spread, raw, v_exact = best
        leak['closure1_rows_leave_one_out_corrected'] += 1
        if raw == 1:
            leak['closure1_singleton_rows_moved_1_to_0'] += 1
        if canon_n(p) != p:
            leak['closure2_rows_folded_into_a_duplicate_master'] += 1
        cells[L].append((p, v, spread, t, types[t]['type_name'], raw,
                         len(ls), len(parishes.get(p, ())), v_exact,
                         keys['normalised'].get(p, ''), keys['exact'].get(p, '')))
    out['leak_closure_rows_moved'] = dict(leak)

    HDR = ['poem_id', 'label_value', 'join_key', 'join_key_name', 'type_id',
           'type_name', 'variant_count_with_self', 'label_value_if_exact_dedup',
           'n_type_links', 'n_parishes_of_poem', 'text_key_norm', 'text_key_exact']
    out['cells'] = {}
    for L, rs in sorted(cells.items()):
        rs.sort()
        # .dedup.tsv keeps ONE row per distinct text. Without it two re-entries
        # of one poem can straddle a train/test split, which is the same leak
        # again one level down: the test item is verbatim in the training set.
        # It collapses on the normalised text key with NO length floor, unlike
        # the counting dedup which requires MINLEN. The two jobs differ: for
        # counting, collapsing two distinct 2-line runos that share a formula
        # would understate a type's real attestation, so the floor is
        # protective; for split safety the risk runs the other way, and a
        # verbatim repeat is a leak however short it is.
        seen_c, seen_k, ded = set(), set(), []
        for r in rs:
            c, k = canon_n(r[0]), r[9]
            if c in seen_c or (k and k in seen_k):
                continue
            seen_c.add(c)
            if k:
                seen_k.add(k)
            ded.append(r)
        for label, col, fname in (('variant_count', 1, 'label_variant_count'),
                                  ('parish_spread', 2, 'label_parish_spread')):
            for suffix, data in (('', rs), ('.dedup', ded)):
                path = os.path.join(HERE, '%s.%s%s.tsv' % (fname, L, suffix))
                with open(path, 'w', encoding='utf-8', newline='') as f:
                    w = csv.writer(f, delimiter='\t', lineterminator='\n')
                    w.writerow(HDR)
                    for r in data:
                        w.writerow([r[0], r[col], r[0], 'filter_poem_id', r[3], r[4],
                                    r[5], r[8] if label == 'variant_count' else '',
                                    r[6], r[7], r[9], r[10]])
        vals = [r[1] for r in rs]
        sp = [r[2] for r in rs]
        disagree = sum(1 for r in rs if r[1] != r[8])
        out['cells'][L] = {
            'rows': len(rs),
            'rows_dedup': len(ded),
            'rows_dropped_by_dedup': len(rs) - len(ded),
            'variant_count_max': max(vals), 'variant_count_mean': round(sum(vals) / len(vals), 3),
            'variant_count_median': sorted(vals)[len(vals) // 2],
            'zero_after_leave_one_out': sum(1 for v in vals if v == 0),
            'ge10_after_leave_one_out': sum(1 for v in vals if v >= 10),
            'parish_spread_max': max(sp), 'parish_spread_mean': round(sum(sp) / len(sp), 3),
            'parish_spread_median': sorted(sp)[len(sp) // 2],
            'rows_whose_label_changes_under_exact_dedup': disagree,
            'rows_whose_label_changes_pct': round(100.0 * disagree / len(rs), 2),
        }


if __name__ == '__main__':
    main()

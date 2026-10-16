"""Summarise the #578 runs in runs/: RSS, cleanup cost, turnaround, output equality.
usage: python3 compare.py RUNS_DIR > SUMMARY.md"""
import glob, json, os, re, statistics as st, sys

R = sys.argv[1]
runs = {os.path.basename(p)[:-5]: json.load(open(p)) for p in sorted(glob.glob(os.path.join(R, '*.json')))}


def norm(s, td):
    s = s.replace(td, '<TMP>')
    s = re.sub(r'finish_bp_[A-Za-z0-9_]{8}\.json', 'finish_bp_<X>.json', s)
    return s


def canon(run):
    """Every frame of every request plus the written defer states, with temp names normalised."""
    td = run['tmpdir']
    reqs = [norm(json.dumps(r['frames'], ensure_ascii=False, sort_keys=True), td) for r in run['rows']]
    states = {k: norm(v, td) for k, v in run['states'].items()}
    shape = [[(f.get('event'), len(f.get('data', '') or ''), f.get('code'), len(f.get('stdout', '') or ''),
               len(f.get('stderr', '') or '')) for f in r['frames']] for r in run['rows']]
    return reqs, states, shape


def raw(run):
    # only this driver's own temp dir replaced: what is left differing is the harness's own output
    return [json.dumps(r['frames'], ensure_ascii=False, sort_keys=True).replace(run['tmpdir'], '<TMP>') for r in run['rows']]


print('# #578 independent measurement (BB8)\n')
cells = sorted({(r['lines'], r['seed']) for r in runs.values()})
for lines, seed in cells:
    print(f'## cell {lines}/{seed}\n')
    pick = lambda pre, t: [v for k, v in runs.items() if k.startswith(f'{pre}_{t}_{lines}_{seed}_')]
    for t in ('base', 'head'):
        for r in pick('ping', t):
            assert r['exit'] == 0 and all(x['code'] in (0, 2, 4) for x in r['rows'])
    # --- RSS (ping runs)
    print('RSS in MiB, median of the ping runs. "ready" = read after the worker answered the ping, i.e. the RSS the next request starts from.\n')
    print('| req | verb | base ready | head ready | Δ | base HWM | head HWM |')
    print('|---|---|---|---|---|---|---|')
    B, Hh = pick('ping', 'base'), pick('ping', 'head')
    for i in range(8):
        b = st.median(r['rows'][i]['rss_ready_mb'] for r in B); h = st.median(r['rows'][i]['rss_ready_mb'] for r in Hh)
        bh = st.median(r['rows'][i]['hwm_ready_mb'] for r in B); hh = st.median(r['rows'][i]['hwm_ready_mb'] for r in Hh)
        print(f"| {i+1} | {B[0]['rows'][i]['verb']} | {b:.0f} | {h:.0f} | {h-b:+.0f} | {bh:.0f} | {hh:.0f} |")
    for lab, rs in (('base', B), ('head', Hh)):
        print(f"\n{lab} whole-sequence peak (ru_maxrss) per run: " + ', '.join(f"{r['ru_maxrss_mb']:.0f}" for r in rs) + ' MiB')
    seq = {t: pick('seq', t) for t in ('base', 'head')}
    for lab in ('base', 'head'):
        if seq[lab]:
            print(f"{lab} peak, back-to-back runs: " + ', '.join(f"{r['ru_maxrss_mb']:.0f}" for r in seq[lab]) + ' MiB')
    # --- cleanup cost
    print('\nTime the worker stays busy after each reply (ping turnaround), seconds:\n')
    bb = [x['after_reply_busy_s'] for r in B for x in r['rows']]
    hb = [x['after_reply_busy_s'] for r in Hh for x in r['rows']]
    q = lambda v, p: sorted(v)[min(len(v) - 1, int(round(p * (len(v) - 1))))]
    print(f"- base: p50 {st.median(bb):.3f}, max {max(bb):.3f} (n={len(bb)}; this is the ping's own round trip)")
    print(f"- head: p50 {st.median(hb):.3f}, p95 {q(hb, .95):.3f}, max {max(hb):.3f} (n={len(hb)})")
    print(f"- head minus base p50 = cleanup cost p50 ≈ {st.median(hb) - st.median(bb):.3f} s")
    print('- head per verb (p50): ' + ', '.join(
        f"{v} {st.median([x['after_reply_busy_s'] for r in Hh for x in r['rows'] if x['verb'] == v]):.3f}"
        for v in ('plan', 'fill', 'grade', 'revise')))
    # --- turnaround (back-to-back)
    if seq['base'] and seq['head']:
        sb = [r['sum_turnaround_s'] for r in seq['base']]; sh = [r['sum_turnaround_s'] for r in seq['head']]
        wb = [r['wall_s'] for r in seq['base']]; wh = [r['wall_s'] for r in seq['head']]
        print(f"\nBack-to-back 8 requests, sum of turnarounds (s): base {sb} median {st.median(sb):.2f}; "
              f"head {sh} median {st.median(sh):.2f}; change {st.median(sh) - st.median(sb):+.2f} s "
              f"({(st.median(sh) / st.median(sb) - 1) * 100:+.1f}%)")
        print(f"Wall from first request to last reply (s): base median {st.median(wb):.2f}, head median {st.median(wh):.2f}")
    # --- output equality
    print('\nOutput equality (every frame of every request, plus the written defer states):\n')
    allr = [(k, v) for k, v in runs.items() if f'_{lines}_{seed}_' in k]
    ref_k, ref = allr[0]
    rc, rs, rsh = canon(ref)
    for k, v in allr[1:]:
        c, s, sh = canon(v)
        rawdiff = sum(a != b for a, b in zip(raw(ref), raw(v)))
        print(f"- {k} vs {ref_k}: normalised requests equal {sum(a == b for a, b in zip(c, rc))}/8, "
              f"states equal {s == rs}, frame shapes equal {sh == rsh}, requests unequal before the finish_bp name is normalised {rawdiff} (revise calls: 3)")
    print()

"""Stage 0 seed count. Read-only measurement, no product code.

For every form the planner knows and seeds 1..N: plan, realise the plan in the
test suite's own placeholder draft (which keeps every planned return word for
word), build the blueprint, and run the structure-only section report. Count
every code that stands. Nothing here is hand-picked: forms come from
PLAN_FORMS, seeds are 1..N, the draft is the suite's fixture.
"""
import os, sys, json, time, collections, multiprocessing as mp
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'lyric-harness')
sys.path.insert(0, ROOT)
N = int(sys.argv[2]) if len(sys.argv) > 2 else 200


def one(job):
    form, seed = job
    from quality import plan as PLN, grid as GR
    sys.path.insert(0, ROOT + '/quality')
    from quality.test_plan import dummy_draft
    try:
        plan = PLN.make_plan(seed=seed, form=form)
    except Exception as e:                      # a refused draw is a result, not an error
        return (form, seed, 'REFUSED', type(e).__name__, str(e)[:160], None)
    try:
        draft = dummy_draft(plan)
        # The suite's fixture cycles 64 end words, so a long song repeats whole
        # lines by accident. Give every line its own first word, then re-apply
        # the plan's own repeat rows, so a repeat exists only where the plan put it.
        def _tag(i):
            out = ''
            while True:
                out = 'abcdefghijklmnopqrstuvwxyz'[i % 26] + out
                i = i // 26 - 1
                if i < 0:
                    return 'w' + out
        draft = [_tag(i) + ' ' + line.split(' ', 1)[1] for i, line in enumerate(draft)]
        for row in (plan['returns'] or '').split(';'):
            if row:
                a, b = (int(x) for x in row.split(','))
                draft[b - 1] = draft[a - 1]
        bp = PLN.fill_plan(plan, draft)
        song, hooks = GR.song_from_blueprint(bp)[:2]
        rep = GR.song_function_report(song, hooks=hooks, rhyme_key=GR.rime_orthographic)
        codes = collections.Counter(f.code for f in rep['findings'])
        codes.update(f.code for f in GR.stanza_lock(song))
        funcs = [s['function'] for s in plan['sections']]
        return (form, seed, 'OK', dict(codes), funcs, plan['total_lines'])
    except Exception as e:
        return (form, seed, 'ERROR', type(e).__name__, str(e)[:200], None)


if __name__ == '__main__':
    from quality import plan as PLN, grid as GR
    out = sys.argv[1]
    jobs = [(form, seed) for form in PLN.PLAN_FORMS for seed in range(1, N + 1)]
    t0 = time.time()
    with mp.get_context('fork').Pool(4) as pool:
        rows = pool.map(one, jobs, chunksize=4)
    json.dump(rows, open(out, 'w'))
    print('seconds', round(time.time() - t0), '| jobs', len(rows))
    for form in PLN.PLAN_FORMS:
        mine = [r for r in rows if r[0] == form]
        ok = [r for r in mine if r[2] == 'OK']
        print(f'--- form={form}: planned {len(ok)} of {len(mine)}; refused {sum(r[2]=="REFUSED" for r in mine)}; errors {sum(r[2]=="ERROR" for r in mine)}')
        songs = collections.Counter(); total = collections.Counter()
        for r in ok:
            for code, k in r[3].items():
                songs[code] += 1; total[code] += k
        for code in sorted(songs, key=lambda c: (-songs[c], c)):
            print(f'  {code:30s} {GR.severity_of(code):5s} in {songs[code]:3d} of {len(ok)} songs ({total[code]} findings)')
        errs = collections.Counter((r[3], r[4][:90]) for r in mine if r[2] != 'OK')
        for (kind, msg), k in errs.most_common(6):
            print(f'  not planned x{k}: {kind}: {msg}')

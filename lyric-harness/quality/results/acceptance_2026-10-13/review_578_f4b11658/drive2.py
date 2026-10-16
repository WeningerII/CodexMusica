"""Independent #578 measurement: one warm mcp/worker.py, the capacity
instrument's own 8-request sequence (plan, fill, then grade + finish x3),
driven exactly as scripts/measure_verb_memory.py --worker drives it.

usage: python3 drive2.py TREE SEED LINES OUT.json [ping|noping]

Per request it records turnaround (request write -> result frame), VmRSS and
VmHWM read at the result frame, and every output frame and the result frame
in full. With `ping`, right after each result frame it sends one unreadable
request (argv not a list). worker.py answers that without running anything
and without release_heap, but only once it is back at its stdin loop, so the
ping's turnaround is the time the worker still spent after the reply (on the
PR head: the release_heap() cost), and the RSS read at the ping's reply is
the RSS the next request starts from. `noping` is the back-to-back timing.
ru_maxrss at exit is the whole sequence's peak.
"""
import hashlib, importlib.util, json, os, queue, subprocess, sys, tempfile, threading, time

TREE, SEED, LINES, OUT = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
PING = (sys.argv[5] if len(sys.argv) > 5 else 'ping') == 'ping'
H = os.path.join(TREE, 'lyric-harness')
spec = importlib.util.spec_from_file_location('mvm', os.path.join(TREE, 'scripts', 'measure_verb_memory.py'))
mvm = importlib.util.module_from_spec(spec); spec.loader.exec_module(mvm)
TOKEN = 'b' * 48  # fixed, so control lines compare across trees


def mem(pid):
    out = {}
    for l in open('/proc/%d/status' % pid):
        if l.startswith(('VmRSS:', 'VmHWM:')):
            out[l.split(':')[0]] = int(l.split()[1]) / 1024.0
    return out.get('VmRSS'), out.get('VmHWM')


td = tempfile.mkdtemp(prefix='q578-')
plan_p, bp_p, draft_p = (os.path.join(td, n) for n in ('plan.json', 'bp.json', 'draft.txt'))
env = {**os.environ, 'PYTHONDONTWRITEBYTECODE': '1', 'LYRIC_CONTROL_TOKEN': TOKEN}
w = subprocess.Popen([sys.executable, os.path.join(TREE, 'mcp', 'worker.py')], cwd=H, stdin=subprocess.PIPE,
                     stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, bufsize=1, env=env)
frames = queue.Queue()
threading.Thread(target=lambda: ([frames.put(l) for l in w.stdout], frames.put(None)), daemon=True).start()
rows, rid = [], 0


def send(obj):
    w.stdin.write(json.dumps(obj) + '\n'); w.stdin.flush()


def call(argv, verb):
    global rid
    rid += 1
    t0 = time.monotonic()
    send({'id': rid, 'argv': argv, 'env': {'LYRIC_CONTROL_TOKEN': TOKEN}})
    out = []
    while True:
        line = frames.get(timeout=900)
        if line is None:
            raise SystemExit('worker exited')
        msg = json.loads(line)
        out.append(msg)
        if msg.get('event') != 'output':
            break
    t1 = time.monotonic()
    rss, hwm = mem(w.pid)
    row = {'id': rid, 'verb': verb, 'code': out[-1].get('code'), 'turnaround_s': round(t1 - t0, 4),
           'rss_at_reply_mb': rss, 'hwm_at_reply_mb': hwm, 'frames': out}
    if PING:
        t2 = time.monotonic()
        send({'id': 'ping', 'argv': 'x'})
        msg = json.loads(frames.get(timeout=900))
        t3 = time.monotonic()
        assert msg.get('code') == -1 and 'unreadable request' in msg.get('stderr', ''), msg
        rss2, hwm2 = mem(w.pid)
        row.update(after_reply_busy_s=round(t3 - t2, 4), rss_ready_mb=rss2, hwm_ready_mb=hwm2)
    rows.append(row)
    print(f"{rid} {verb:6s} code={row['code']} t={row['turnaround_s']:.2f}s rss@reply={rss:.0f} "
          + (f"busy_after={row['after_reply_busy_s']:.3f}s rss_ready={row['rss_ready_mb']:.0f} " if PING else '')
          + f"hwm={row.get('hwm_ready_mb', hwm):.0f}", flush=True)


# the instrument's own deterministic filler draft and plan
p = subprocess.run([sys.executable, 'lyric_harness.py', 'plan', f'--seed={SEED}', f'--lines={LINES}', f'--out={plan_p}'],
                   cwd=H, capture_output=True, text=True, env=env)
assert p.returncode == 0, p.stdout[-500:]
lines = [f"{mvm._STARTS[i % len(mvm._STARTS)]} {mvm._ENDS[i % len(mvm._ENDS)]}" for i in range(LINES)]
open(draft_p, 'w').write('\n'.join(lines) + '\n')
base = [f'--seed={SEED}', f'--lines={LINES}']
t_all = time.monotonic()
call(['plan', *base, f'--out={plan_p}'], 'plan')
call(['plan', *base, f'--fill={draft_p}', f'--out={bp_p}'], 'fill')
grade = mvm._grade_args(json.load(open(plan_p)), bp_p, draft_p)
for i in range(3):
    call(grade, 'grade')
    call(['finish', draft_p, *base, f'--propose=defer:{os.path.join(td, "state%d.json" % i)}'], 'revise')
w.stdin.close()
_, status, ru = os.wait4(w.pid, 0)
res = {'tree': subprocess.run(['git', '-C', TREE, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip(),
       'python': sys.version.split()[0], 'seed': SEED, 'lines': LINES, 'ping': PING, 'tmpdir': td,
       'draft_sha256': hashlib.sha256('\n'.join(lines).encode()).hexdigest(),
       'sum_turnaround_s': round(sum(r['turnaround_s'] for r in rows), 3), 'wall_s': round(time.monotonic() - t_all, 3),
       'exit': os.waitstatus_to_exitcode(status), 'ru_maxrss_mb': ru.ru_maxrss / 1024.0, 'rows': rows,
       'states': {n: open(os.path.join(td, n)).read() for n in sorted(os.listdir(td)) if n.startswith('state')}}
json.dump(res, open(OUT, 'w'), indent=1, ensure_ascii=False)
print(f"sum_turnaround={res['sum_turnaround_s']}s peak(ru_maxrss)={res['ru_maxrss_mb']:.0f}MiB exit={res['exit']}")

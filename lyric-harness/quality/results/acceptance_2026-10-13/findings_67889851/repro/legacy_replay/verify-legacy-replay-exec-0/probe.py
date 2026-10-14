import sys, os, json, tempfile, io, contextlib
sys.path.insert(0, os.getcwd())
import lyric_harness as LH
d = tempfile.mkdtemp(dir=sys.argv[1])
def w(name, obj):
    p = os.path.join(d, name); json.dump(obj, open(p, "w")); return p
ans = {"propose": [{"line": 1, "attempt": 0, "text": "x"}], "propose_group": []}
for label, extra in (("absent", {}), ("null", {"reader_scheme": None}), ("v1", {"reader_scheme": "v1"}),
                     ("empty-string", {"reader_scheme": ""}), ("v9", {"reader_scheme": "v9"})):
    st = {"version": 1, "answered": dict(ans), "pending": None, **extra}
    ps = w(f"st_{label}.json", st)
    pr = w(f"rp_{label}.json", {**ans, **extra})
    pc = w(f"ck_{label}.json", {"version": 1, **extra})
    os.environ["LYRIC_CHECKPOINT_PATH"] = pc
    rec_defer = LH._recorded_reader_scheme(["revise", "--propose=defer:" + ps])
    rec_replay = LH._recorded_reader_scheme(["revise", "--propose=replay:" + pr])
    rec_ck = LH._recorded_reader_scheme(["revise", "--propose=call:m:f"])
    rs = LH._defer_record_scheme(json.load(open(ps)), recorded=True)
    LH._ACTIVE_READER_SCHEME, LH._READER_SCHEME_DECLARED = "v2", False
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            chk = LH._defer_scheme_check(ps, json.load(open(ps)))
    except SystemExit as e:
        chk = f"REFUSED(exit {e.code})"
    print(f"{label:13s} _defer_record_scheme={rs!r:6} _defer_scheme_check(noflag,v2)={chk!r:22} recorded[defer]={rec_defer!r:6} recorded[replay]={rec_replay!r:6} recorded[ckpt]={rec_ck!r}")

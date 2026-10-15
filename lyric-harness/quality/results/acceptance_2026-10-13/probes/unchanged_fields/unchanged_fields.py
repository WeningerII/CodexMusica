"""Unchanged-fields gate for the `schema_instance_evidence` sibling (#567).

    python3 unchanged_fields.py CANDIDATE_TREE CONTROL_TREE OUT.json [PYTHON]

The tools lane adds a versioned `schema_instance_evidence` key to the
lyric-result machine record. The frozen design (#553 6197181134) says that
key is a report-time sibling: no comparator, taxonomy, threshold or other
record field may move. This gate runs each tree's own `lyric_harness.py
brief` over a fixed draft set and requires:

  1. every record field except `schema_instance_evidence` to be byte-identical
     (canonical JSON) between CANDIDATE and CONTROL, and the exit codes equal;
  2. on CANDIDATE, the sibling to be present with `version == 1` on every
     graded record;
  3. the sibling's own coverage to be self-consistent: `complete` only when
     its status says complete, every method is answered and nothing remains
     unknown; an unknown remainder never carries a numeric total.

CONTROL is the same tree without the tools lane's harness change (for a lane
head, its base; for a combined tree, the combined tree with the H1-and-earlier
`lyric_harness.py` restored). Each tree is a checkout root with
`lyric-harness/cmudict.dict` staged; LYRIC_STAGED_DATA must name a data dir
holding the gitignored assets. Exit 0 when (1) and (2) hold for every case.
Only the `brief` (graded) record site is exercised; the `finish` site needs a
revise loop and is not covered here.
"""
import json, os, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

CAND, CTRL, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
PY = sys.argv[4] if len(sys.argv) > 4 else sys.executable
KEY = "schema_instance_evidence"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO_HARNESS = os.path.join(CAND, "lyric-harness")

# (name, lines-or-path, extra argv). Paths are relative to lyric-harness/.
INLINE = [
    ("h1_read_dash", ["Read--read, read it again", "the bed is made for me"],
     ["--groups=1.T2,2.T2", "--relation=perfect rhyme", "--numbering=v2"]),
    ("h1_lead_dash", ["Lead--lead, lead the way", "the bed is made for me"],
     ["--groups=1.T2,2.T2", "--relation=perfect rhyme", "--numbering=v2"]),
    ("h4_unmarked_refuse", ["I 2 love you love", "the dove above"],
     ["--groups=1.T3,2.end", "--relation=perfect rhyme"]),
    ("pa_love_voices_off", ["Oh--oh, (ah) oh my love", "a song for us above"],
     ["--groups=1.T5,2.end", "--numbering=v2"]),
    ("pa_love_voices_on", ["Oh--oh, (ah) oh my love", "a song for us above"],
     ["--groups=1.T6,2.end", "--numbering=v2+voices", "--voices"]),
]
FILES = [
    ("fx_song", "quality/fixtures/song.txt", ["--cliques"]),
    ("fx_mandate_song", "quality/fixtures/mandate_song.txt", ["--cliques"]),
    ("fx_mandate_couplets", "quality/fixtures/mandate_couplets.txt", ["--cliques"]),
    ("fx_anaphoric", "quality/fixtures/anaphoric.txt", ["--cliques"]),
    ("fx_moonlight", "quality/fixtures/moonlight_fixture.txt", ["--cliques"]),
    ("song_carry_it_over", "songs/carry_it_over.txt", ["--cliques"]),
    ("song_crooked_waltz", "songs/crooked_waltz.txt", ["--cliques"]),
    ("song_i_am_not_leaving", "songs/i_am_not_leaving.txt", ["--cliques"]),
]
# Inline drafts run under both supplements; the longer drafts under v2 only
# (each takes ~30-40 s per tree).
FILE_SUPPLEMENTS = ("v2",)
SUPPLEMENTS = ("none", "v2")


def run(tree, argv):
    h = os.path.join(tree, "lyric-harness")
    env = dict(os.environ)
    p = subprocess.run([PY, "lyric_harness.py"] + argv, capture_output=True, text=True,
                       env=env, cwd=h, timeout=900)
    rec = None
    for line in p.stdout.splitlines():
        if line.startswith("  lyric result: "):
            rec = json.loads(line[len("  lyric result: "):])
    return p.returncode, rec


def canon(x):
    return json.dumps(x, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def strip(rec):
    return None if rec is None else {k: v for k, v in rec.items() if k != KEY}


def field_diffs(a, b):
    if a is None or b is None:
        return [] if a is b else ["<record presence differs>"]
    keys = sorted(set(a) | set(b))
    return [k for k in keys if canon(a.get(k)) != canon(b.get(k))]


def coverage_problems(ev):
    """Self-consistency of the sibling's own coverage block (empty = fine)."""
    if not isinstance(ev, dict):
        return []
    cov = ev.get("coverage") or {}
    out = []
    methods = cov.get("methods") or []
    if cov.get("complete") and cov.get("status") != "complete":
        out.append("complete=true but status=%r" % cov.get("status"))
    if not cov.get("complete") and cov.get("status") == "complete":
        out.append("status complete but complete=false")
    if cov.get("complete") and any(m.get("status") != "answered" for m in methods):
        out.append("complete with a non-answered method")
    if cov.get("complete") and cov.get("remaining_records_unknown"):
        out.append("complete with an unknown remainder")
    if cov.get("remaining_records_unknown") and cov.get("total_records") is not None:
        out.append("unknown remainder but total_records=%r" % cov.get("total_records"))
    return out


rows, ok = [], True
with tempfile.TemporaryDirectory() as td:
    cases = []
    for name, lines, extra in INLINE:
        p = os.path.join(td, name + ".txt")
        open(p, "w", encoding="utf-8").write("\n".join(lines) + "\n")
        cases.append((name, p, extra))
    for name, rel, extra in FILES:
        cases.append((name, os.path.join(REPO_HARNESS, rel), extra))
    n_inline = len(INLINE)
    for i, (name, path, extra) in enumerate(cases):
        for sup in (SUPPLEMENTS if i < n_inline else FILE_SUPPLEMENTS):
            ex = [e if not e.startswith("--blueprint=") else "--blueprint=" + os.path.join(REPO_HARNESS, e.split("=", 1)[1])
                  for e in extra]
            argv = [f"--lexicon-supplement={sup}", "--reader-scheme=v2", "brief", path] + ex
            with ThreadPoolExecutor(2) as pool:
                fc, fk = pool.submit(run, CAND, argv), pool.submit(run, CTRL, argv)
                (rc_c, rec_c), (rc_k, rec_k) = fc.result(), fk.result()
            diffs = field_diffs(strip(rec_c), strip(rec_k))
            graded = rec_c is not None and rec_c.get("status") == "graded"
            ev = (rec_c or {}).get(KEY)
            has_ev = isinstance(ev, dict) and ev.get("version") == 1
            cov = (rec_c or {}).get("coverage") or {}
            refused_pairs = cov.get("pairs_refused") or 0
            cov_bad = coverage_problems(ev)
            passed = (rc_c == rc_k) and not diffs and (has_ev or not graded) and not cov_bad
            ok &= passed
            rows.append({"case": name, "supplement": sup, "rc": [rc_c, rc_k],
                         "status": (rec_c or {}).get("status"), "fields_differing": diffs,
                         "sibling_present_v1": has_ev, "sibling_bytes": len(canon(ev)) if ev is not None else 0,
                         "record_pairs_refused": refused_pairs,
                         "sibling_coverage": {k: v for k, v in ((ev or {}).get("coverage") or {}).items() if k != "methods"},
                         "sibling_records": len((ev or {}).get("records") or []), "coverage_problems": cov_bad,
                         "pass": passed})
            print(f"{name:24s} sup={sup:4s} rc={rc_c}/{rc_k} status={str((rec_c or {}).get('status')):9s} "
                  f"diff={diffs or '-'} sibling={'v1' if has_ev else '-'} "
                  f"cov={((ev or {}).get('coverage') or {}).get('status', '-')} {cov_bad or ''} {'PASS' if passed else 'FAIL'}")

json.dump({"candidate": subprocess.run(["git", "-C", CAND, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip(),
           "control": subprocess.run(["git", "-C", CTRL, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip(),
           "ok": ok, "rows": rows}, open(OUT, "w"), indent=1)
print("OK" if ok else "FAIL")
sys.exit(0 if ok else 1)
